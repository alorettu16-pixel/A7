import db, { strategies, decisionJournal, paperTrades, riskLimits } from "@/db";
import { eq, gte } from "drizzle-orm";
import { generateSignals } from "@/signals/generator";
import { StrategyRules } from "@/backtest/engine";
import { getCandles } from "@/market-data";
import { openPaperTrade, closePaperTrade } from "@/paper-trading/engine";
import { log, logSignal, logClose, logError, logBlock } from "@/lib/logger";
import { sendTelegram, formatTradeOpen, formatTradeClose, formatAlert, formatError } from "@/lib/telegram";

// Asset monitorati — più ampia copertura per più segnali
const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT"];

async function main() {
  const activeStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "paper_active"));

  if (activeStrategies.length === 0) {
    console.log("Nessuna strategia attiva.");
    process.exit(0);
  }

  // ─── Risk Limits ────────────────────────────────────────────────────────
  const limits = await db.select().from(riskLimits).limit(1);
  const risk = limits.length > 0 ? limits[0] : null;

  if (risk?.killSwitchActive) {
    logBlock("KILL SWITCH ATTIVO");
    await sendTelegram(formatAlert("Kill Switch Attivo", "Il kill switch è inserito. Nessuna operazione verrà aperta o chiusa fino a rimozione manuale."));
    process.exit(0);
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const recentTrades = await db.select().from(paperTrades).where(gte(paperTrades.openedAt, yesterday));
  const dailyPnl = recentTrades.reduce((s, t) => s + (t.realizedPnl || 0) + (t.unrealizedPnl || 0), 0);
  const demoBudget = risk?.demoBudgetUsd || 10000;
  const dailyDrawdownPct = demoBudget > 0 ? Math.abs(dailyPnl) / demoBudget * 100 : 0;
  const maxDrawdownPct = risk?.maxDailyDrawdownPct || 10;

  if (dailyPnl < 0 && dailyDrawdownPct >= maxDrawdownPct) {
    console.log(`🛑 Drawdown giornaliero ${dailyDrawdownPct.toFixed(1)}% >= ${maxDrawdownPct}% — blocco.`);
    await sendTelegram(formatAlert("Drawdown Massimo Raggiunto",
      `Drawdown giornaliero ${dailyDrawdownPct.toFixed(1)}% ≥ ${maxDrawdownPct}% — ciclo bloccato.\nPnL oggi: ${dailyPnl.toFixed(2)}$\nSblocco manuale richiesto.`
    ));
    process.exit(0);
  }

  const openTradesAll = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
  const totalExposure = openTradesAll.reduce((s, t) => s + (t.simulatedPositionSize || 0), 0);
  const maxExposure = risk?.maxTotalExposureUsd || 500;

  const allTimePnl = db.select().from(paperTrades).all().reduce(
    (s: number, t: any) => s + (t.realizedPnl || 0), 0
  );
  const availableEquity = Math.max(0, demoBudget + allTimePnl);
  const budgetBasedMaxExposure = Math.min(maxExposure, availableEquity);

  if (totalExposure >= budgetBasedMaxExposure) {
    console.log(`🛑 Esposizione totale ${totalExposure.toFixed(2)}$ >= budget ${budgetBasedMaxExposure.toFixed(2)}$ — blocco.`);
    await sendTelegram(formatAlert("Esposizione Massima Raggiunta",
      `Esposizione ${totalExposure.toFixed(2)}$ ≥ ${budgetBasedMaxExposure.toFixed(2)}$ — nessun nuovo trade.\nRiprovare al prossimo ciclo.`
    ));
    process.exit(0);
  }

    const maxPositionSize = Math.min(risk?.maxPositionSizeUsd || 100, availableEquity * 0.1);
  let positionSize = Math.min(maxPositionSize, budgetBasedMaxExposure - totalExposure);
  let currentExposure = totalExposure; // tracciamento real-time dell'esposizione

    // ─── Mappa trade aperti per asset ────────────────────────────────────────
  const openByAsset: Record<string, Set<number>> = {};
  for (const asset of ASSETS) {
    openByAsset[asset] = new Set(
      openTradesAll.filter(t => t.asset === asset).map(t => t.strategyId)
    );
  }

  let totalSignals = 0;
  let closedCount = 0;

  // ─── Reverse Signal + Generazione ────────────────────────────────────────
  // MACD LONG+SHORT ottimizzate per 4h
  const TF = "4h";
  const LOOKBACK_HOURS = 720; // 30gg per avere abbastanza candele 4h (~180)

  const checkAsset = async (asset: string, assetOpen: Set<number>) => {
    console.log(`\n🔍 ${asset} ${TF}...`);

    // Carica candele 4h (ultime 30gg = ~180 candele per warmup indicatori)
    const candles = await getCandles(asset, TF, new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000), new Date(), "bitget");

    if (candles.length < 10) {
      console.log(`   ⚠ Dati insufficienti per ${asset} (${candles.length} candele)`);
      return;
    }

    // ─── Reverse Signal ──────────────────────────────────────────────────────
    if (assetOpen.size > 0) {
      for (const sid of assetOpen) {
        const trade = openTradesAll.find(t => t.strategyId === sid && t.asset === asset && t.status === "open");
        if (!trade) continue;

        const strat = activeStrategies.find(s => s.id === sid);
        if (!strat) continue;

        const rules: StrategyRules = {
          entry: JSON.parse(strat.entryRulesJson),
          exit: JSON.parse(strat.exitRulesJson),
        };

        const hasIndicatorExit = rules.exit.some(e => e.type === "indicator");
        if (!hasIndicatorExit) continue;

        // Se abbiamo raggiunto il limite di esposizione, interrompi il reverse signal
        if (totalSignals < -998) { console.log(`   ⏸ Esposizione massima raggiunta — skip reverse signal`); return; }

        const signals = await generateSignals(sid, rules, asset, "15m", candles, false);
        if (signals.length === 0) {
          const currentPrice = candles[candles.length - 1].close;
          // Non chiudiamo per reverse signal su tutti — solo se la strategia ha indicator exit
          // Per ora, chiudiamo solo se entrambe le condizioni sono false
          const pnlClose = (currentPrice - trade.entryPrice) / trade.entryPrice * (trade.simulatedPositionSize || 200) * (trade.side === "short" ? -1 : 1);
          await closePaperTrade(trade.id, currentPrice);
          console.log(`  🔒 Trade #${trade.id} ${asset} ${strat.name}: chiuso per reverse signal @ ${currentPrice} (PnL ${pnlClose.toFixed(2)}$)`);
          await sendTelegram(formatTradeClose(trade.id, asset, trade.side, trade.entryPrice, currentPrice, pnlClose, "reverse_signal", strat.name));
          closedCount++;
          assetOpen.delete(sid);
        }
      }
    }

    // ─── Nuovi segnali ────────────────────────────────────────────────────────
    for (const s of activeStrategies) {
      const alreadyOpen = assetOpen.has(s.id);
      const rules: StrategyRules = {
        entry: JSON.parse(s.entryRulesJson),
        exit: JSON.parse(s.exitRulesJson),
      };

      // Direzione esplicita dalla strategia (se presente in parametersJson)
      let explicitDirection: "long" | "short" | null = null;
      try {
        const params = JSON.parse(s.parametersJson);
        if (params.direction === "long" || params.direction === "short") {
          explicitDirection = params.direction;
        }
      } catch { /* ignora parametri non parsabili */ }

      try {
        const signals = await generateSignals(s.id, rules, asset, TF, candles, alreadyOpen, explicitDirection);

        for (const signal of signals) {
          // Calcola posizione evitando di sforare il limite di esposizione
          const remainingBudget = budgetBasedMaxExposure - currentExposure;
          if (remainingBudget <= 0) {
            console.log(`   🛑 Esposizione massima raggiunta (${currentExposure.toFixed(2)}$) — ciclo terminato`);
            totalSignals = -999;
            return;
          }

          // ── Sizing globale: legge da risk_limits ────────────────────────────────
          let desiredSize = positionSize; // default: cap globale
          let leverage = 1;
          try {
            const riskRows = await db.select().from(riskLimits).limit(1);
            if (riskRows.length > 0) {
              const r = riskRows[0];
              const sizingMode = r.globalSizingMode || "fixed";
              const sizingValue = r.globalSizingValue ?? 100;
              if (sizingMode === "percent") {
                const currentBudget = demoBudget + allTimePnl;
                desiredSize = currentBudget * (sizingValue / 100);
              } else {
                desiredSize = sizingValue;
              }
              leverage = r.maxLeverageAllowed || 1;
            }
          } catch { /* ignora */ }

          // Applica leva: la dimensione collaterale rimane desiredSize,
          // ma l'esposizione effettiva (e il PnL) viene scalata dalla leva
          const effectiveExposure = desiredSize * leverage;

          // Cap alla remainingBudget e al maxPositionSize globale
          const actualSize = Math.min(effectiveExposure, remainingBudget, maxPositionSize);

          const decision = await db.insert(decisionJournal).values({
            strategySignalId: undefined,
            strategyId: s.id,
            decision: "paper_copy",
            confidenceScore: signal.confidence,
            reasonsJson: JSON.stringify([signal.reason]),
            risksJson: JSON.stringify(["Rischio standard di mercato"]),
            simulatedPositionSize: actualSize,
          });

          const tradeId = await openPaperTrade(
            Number(decision.lastInsertRowid),
            s.id,
            signal.asset,
            signal.side,
            signal.price,
            actualSize,
          );

          const icon = signal.side === "long" ? "📈" : "📉";
          console.log(`   ${icon} ${asset} ${s.name}: ${signal.side} @ ${signal.price} — Trade #${tradeId} (size: ${actualSize}$)`);
          await sendTelegram(formatTradeOpen(tradeId, signal.asset, signal.side, signal.price, actualSize, s.name));
          totalSignals++;
          assetOpen.add(s.id);
          currentExposure += actualSize;
        }

        if (signals.length === 0 && !alreadyOpen) {
          console.log(`   ⏸ ${asset} ${s.name}: nessun segnale`);
        } else if (alreadyOpen) {
          console.log(`   ⏸ ${asset} ${s.name}: già un trade aperto`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ ${asset} ${s.name}: ${msg.slice(0, 100)}`);
        await sendTelegram(formatError(asset, s.name, msg));
      }
    }
  };

  // Scansiona tutti gli asset
  for (const asset of ASSETS) {
    await checkAsset(asset, openByAsset[asset]);
  }

  console.log(`\n✅ ${totalSignals} segnali, ${closedCount} chiusi per reverse signal.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});