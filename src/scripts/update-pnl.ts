import db, { paperTrades, strategies } from "@/db";
import { eq } from "drizzle-orm";
import { getCandles } from "@/market-data";
import { closePaperTrade } from "@/paper-trading/engine";
import { ExitRule } from "@/backtest/engine";
import { sendTelegram, formatTradeClose, formatStartup } from "@/lib/telegram";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT"];

async function main() {
  const openTrades = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
  if (openTrades.length === 0) {
    console.log("📦 Nessuna posizione aperta da aggiornare.");
    process.exit(0);
  }

  // Raggruppa per asset per non fetchare lo stesso ticker più volte
  const byAsset: Record<string, typeof openTrades> = {};
  for (const t of openTrades) {
    if (!byAsset[t.asset]) byAsset[t.asset] = [];
    byAsset[t.asset].push(t);
  }

  console.log(`📦 Aggiornamento prezzi per ${openTrades.length} posizioni aperte...\n`);

  // Carica le strategie per leggere SL/TP
  const allStrategies = db.select().from(strategies).all();

  for (const [asset, trades] of Object.entries(byAsset)) {
    try {
      // Prendi l'ultima candela 1m per prezzo più fresco possibile
      const candles = await getCandles(asset, "1m", new Date(Date.now() - 60 * 60 * 1000), new Date(), "bitget");
      if (candles.length === 0) {
        console.log(`   ⚠ ${asset}: nessun dato`);
        continue;
      }

      const latest = candles[candles.length - 1];
      const currentPrice = latest.close;
      const currentHigh = latest.high;
      const currentLow = latest.low;

      for (const t of trades) {
        const entryPrice = t.entryPrice;
        const size = t.simulatedPositionSize || 0;
        const side = t.side as "long" | "short";

        // PnL basato su frazione di prezzo
        let unrealizedPnl: number;
        if (side === "long") {
          unrealizedPnl = (currentPrice - entryPrice) / entryPrice * size;
        } else {
          unrealizedPnl = (entryPrice - currentPrice) / entryPrice * size;
        }
        const pnlPct = (unrealizedPnl / size) * 100;

        // Calcola PnL% basato su high/low per SL/TP (come backtest engine)
        const pnlPctHigh = side === "long"
          ? (currentHigh - entryPrice) / entryPrice * 100
          : (entryPrice - currentLow) / entryPrice * 100;
        const pnlPctLow = side === "long"
          ? (currentLow - entryPrice) / entryPrice * 100
          : (entryPrice - currentHigh) / entryPrice * 100;

        // Cerca la strategia per leggere SL/TP + time exit
        const strat = allStrategies.find(s => s.id === t.strategyId);
        let closed = false;

        // ─── Time Exit Check ─────────────────────────────────────────────
        if (strat) {
          const openedAt = new Date(t.openedAt).getTime();
          const now = Date.now();
          const elapsedHours = (now - openedAt) / (1000 * 60 * 60);

          // Legge timeExitHours da parametersJson (default 96)
          let timeExitHours = 96;
          try {
            const p = JSON.parse(strat.parametersJson || "{}");
            timeExitHours = p.timeExitHours ?? 96;
          } catch {}

          if (elapsedHours >= timeExitHours) {
            const pnl = (currentPrice - t.entryPrice) / t.entryPrice * (t.simulatedPositionSize || 200) * (side === "short" ? -1 : 1);
            console.log(`   ⏰ #${t.id} ${asset} ${side}: time exit ${timeExitHours}h scaduto → chiusura @ ${currentPrice} (elapsed ${elapsedHours.toFixed(1)}h)`);
            await closePaperTrade(t.id, currentPrice);
            await sendTelegram(formatTradeClose(t.id, asset, side, t.entryPrice, currentPrice, pnl, "time_exit", strat?.name || "?"));
            closed = true;
          }
        }

        if (!closed && strat) {
          const exitRules: ExitRule[] = JSON.parse(strat.exitRulesJson);
          for (const ex of exitRules) {
            if (ex.type === "tp") {
              const tpPct = ex.params.pct ?? 10;
              if (pnlPctHigh >= tpPct) {
                const pnl = (currentPrice - t.entryPrice) / t.entryPrice * (t.simulatedPositionSize || 200);
                console.log(`   🎯 #${t.id} ${asset} ${side}: TP ${tpPct}% raggiunto (high ${pnlPctHigh.toFixed(2)}%) → chiusura @ ${currentPrice}`);
                await closePaperTrade(t.id, currentPrice);
                await sendTelegram(formatTradeClose(t.id, asset, side, t.entryPrice, currentPrice, pnl, "take_profit", strat?.name || "?"));
                closed = true;
                break;
              }
            }
            if (ex.type === "sl") {
              const slPct = ex.params.pct ?? 5;
              if (pnlPctLow <= -slPct) {
                const pnl = (currentPrice - t.entryPrice) / t.entryPrice * (t.simulatedPositionSize || 200) * (side === "short" ? -1 : 1);
                console.log(`   🛑 #${t.id} ${asset} ${side}: SL ${slPct}% raggiunto (low ${pnlPctLow.toFixed(2)}%) → chiusura @ ${currentPrice}`);
                await closePaperTrade(t.id, currentPrice);
                await sendTelegram(formatTradeClose(t.id, asset, side, t.entryPrice, currentPrice, pnl, "stop_loss", strat?.name || "?"));
                closed = true;
                break;
              }
            }
          }
        }

        if (!closed) {
          db.update(paperTrades)
            .set({ currentPrice, unrealizedPnl })
            .where(eq(paperTrades.id, t.id))
            .run();

          const arrow = unrealizedPnl > 0 ? "🟢" : unrealizedPnl < 0 ? "🔴" : "⚪";
          console.log(`   ${arrow} #${t.id} ${asset} ${side} | entry=${entryPrice} → ${currentPrice} | uPnL=${unrealizedPnl.toFixed(2)}$ (${pnlPct.toFixed(2)}%)`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠ ${asset}: ${msg.slice(0, 80)}`);
    }
  }

  // Riepilogo
  const allOpen = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
  const totalUPnL = allOpen.reduce((s, t) => s + (t.unrealizedPnl || 0), 0);
  const totalExposure = allOpen.reduce((s, t) => s + (t.simulatedPositionSize || 0), 0);
  console.log(`\n📊 Riepilogo: ${allOpen.length} posizioni, esposizione ${totalExposure.toFixed(2)}$, uPnL ${totalUPnL.toFixed(2)}$`);
}

main().catch(console.error);