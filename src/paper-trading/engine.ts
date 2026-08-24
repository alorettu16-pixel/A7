import db, { paperTrades, pnlSnapshots, strategies } from "@/db";
import { eq, and } from "drizzle-orm";
import { getCandles } from "@/market-data";
import { sendTelegram, formatTradeClose } from "@/lib/telegram";

const FEE_RATE = 0.0006; // 0.06% taker Bitget futures USDT-M
const SLIPPAGE_RATE = 0.0003; // 0.03% slippage

// ─── ATR calculation ────────────────────────────────────────────────────────
function computeATR(candles: { high: number; low: number; close: number }[], period: number): number[] {
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  const result: number[] = [];
  const k = 1 / period;
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < tr.length; i++) {
    prev = tr[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

// ─── Trend direction helper (EMA 200) ───────────────────────────────────────
function getTrend(closes: number[], period = 200): "bullish" | "bearish" | "neutral" {
  if (closes.length < period + 5) return "neutral";
  const emaVals = computeEMA(closes, period);
  const currentPrice = closes[closes.length - 1];
  const currentEma = emaVals[emaVals.length - 1];
  if (currentPrice === undefined || currentEma === undefined) return "neutral";
  const prevEma = emaVals[emaVals.length - 3];
  if (prevEma === undefined) return "neutral";
  const slope = (currentEma - prevEma) / prevEma;
  if (currentPrice > currentEma && slope > -0.001) return "bullish";
  if (currentPrice < currentEma && slope < 0.001) return "bearish";
  return "neutral";
}

function computeEMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < closes.length; i++) {
    prev = closes[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

// Default exit rules (fallback quando la strategia non ha parametri)
const DEFAULT_EXIT_RULES = {
  takeProfitPct: 2.0,
  stopLossPct: 1.0,
  timeExitHours: 48,
  trailingActivatePct: 1.0,
  trailingDistancePct: 0.5,
};

interface ExitCheckResult {
  shouldClose: boolean;
  exitPrice: number;
  reason: string;
}

interface ExitRules {
  takeProfitPct: number;
  stopLossPct: number;
  timeExitHours: number;
  trailingActivatePct: number;
  trailingDistancePct: number;
}

/** 
 * Calcola lo stop loss dinamico usando ATR.
 * Long: max(SL%, ATR × 1.5) — SL più largo in alta volatilità (trend favorevole)
 * Short: min(SL%, ATR × 1.5) — SL più stretto in alta volatilità (trend contrario)
 * Recupera le candele 4h per calcolare l'ATR sul timeframe corretto.
 */
async function getDynamicStopPct(
  asset: string,
  entryPrice: number,
  baseSlPct: number,
  side: "long" | "short" = "long",
  atrPeriod: number = 14,
  atrMultiplier: number = 1.5
): Promise<number> {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - (atrPeriod + 5) * 4 * 3600 * 1000); // (period+5) barre 4h
    const candles = await getCandles(asset, "4h", from, now, "bitget");
    if (candles.length < atrPeriod + 2) return baseSlPct; // fallback a SL fisso

    const atrVals = computeATR(candles, atrPeriod);
    const currentAtr = atrVals[atrVals.length - 1] ?? 0;
    const atrPct = (currentAtr * atrMultiplier) / entryPrice * 100;

    if (side === "short") {
      // Short: volatilità alta = rischio maggiore vs trend → SL più stretto
      const dynamicSl = Math.min(baseSlPct, atrPct);
      return Math.round(dynamicSl * 100) / 100;
    }
    // Long: volatilità alta = movimento normale in trend favorevole → SL più largo
    const dynamicSl = Math.max(baseSlPct, atrPct);
    return Math.round(dynamicSl * 100) / 100;
  } catch {
    return baseSlPct; // fallback silenzioso
  }
}

/**
 * Legge i parametri SL/TP dalla strategia se presenti, altrimenti usa default
 */
async function getExitRulesForTrade(tradeId: number): Promise<ExitRules> {
  try {
    const trade = db.select().from(paperTrades).where(eq(paperTrades.id, tradeId)).limit(1).get();
    if (!trade) return DEFAULT_EXIT_RULES;

    const strat = db.select().from(strategies).where(eq(strategies.id, trade.strategyId)).limit(1).get();
    if (!strat) return DEFAULT_EXIT_RULES;

    const params = JSON.parse(strat.parametersJson || "{}");

    const sl = params.slPct ?? params.sl ?? params.stopLossPct ?? null;
    const tp = params.tpPct ?? params.tp ?? params.takeProfitPct ?? null;
    const timeH = params.timeExit ?? params.timeExitHours ?? null;

    // ── ATR Dynamic Stop: calcola lo stop effettivo ───────────────────────
    let effectiveSl = sl ?? DEFAULT_EXIT_RULES.stopLossPct;
    if (trade.entryPrice) {
      effectiveSl = await getDynamicStopPct(trade.asset, trade.entryPrice, effectiveSl, trade.side as "long" | "short");
    }

    return {
      takeProfitPct: tp ?? DEFAULT_EXIT_RULES.takeProfitPct,
      stopLossPct: effectiveSl,
      timeExitHours: timeH ?? DEFAULT_EXIT_RULES.timeExitHours,
      trailingActivatePct: DEFAULT_EXIT_RULES.trailingActivatePct,
      trailingDistancePct: DEFAULT_EXIT_RULES.trailingDistancePct,
    };
  } catch {
    return DEFAULT_EXIT_RULES;
  }
}

function checkExits(
  trade: {
    side: "long" | "short";
    entryPrice: number;
    currentPrice: number;
    openedAt: string;
  },
  rules: ExitRules,
  highestPrice?: number,
  lowestPrice?: number,
): ExitCheckResult {
  const entryPrice = trade.entryPrice;
  const currentPrice = trade.currentPrice;
  const side = trade.side as "long" | "short";

  // Per SL/TP usa il prezzo peggiore della finestra (intra-candle)
  const worstPrice = side === "long"
    ? (lowestPrice !== undefined ? lowestPrice : currentPrice)
    : (highestPrice !== undefined ? highestPrice : currentPrice);
  const bestPriceForTp = side === "long"
    ? (highestPrice !== undefined ? highestPrice : currentPrice)
    : (lowestPrice !== undefined ? lowestPrice : currentPrice);

  const slPnlPct = side === "long"
    ? (worstPrice - entryPrice) / entryPrice * 100
    : (entryPrice - worstPrice) / entryPrice * 100;
  const tpPnlPct = side === "long"
    ? (bestPriceForTp - entryPrice) / entryPrice * 100
    : (entryPrice - bestPriceForTp) / entryPrice * 100;

  // 1. Stop Loss (controlla lowest/highest intra-candle)
  if (slPnlPct <= -rules.stopLossPct) {
    const slPrice = side === "long"
      ? entryPrice * (1 - rules.stopLossPct / 100)
      : entryPrice * (1 + rules.stopLossPct / 100);
    return { shouldClose: true, exitPrice: slPrice, reason: "stop_loss" };
  }

  // 2. Take Profit (controlla highest/lowest intra-candle)
  if (tpPnlPct >= rules.takeProfitPct) {
    const tpPrice = side === "long"
      ? entryPrice * (1 + rules.takeProfitPct / 100)
      : entryPrice * (1 - rules.takeProfitPct / 100);
    return { shouldClose: true, exitPrice: tpPrice, reason: "take_profit" };
  }

  // 3. Trailing Stop
  if (highestPrice !== undefined && lowestPrice !== undefined) {
    const bestPrice = side === "long" ? highestPrice : lowestPrice;
    const bestPnlPct = side === "long"
      ? (bestPrice - entryPrice) / entryPrice * 100
      : (entryPrice - bestPrice) / entryPrice * 100;

    if (bestPnlPct >= rules.trailingActivatePct) {
      const trailPnlPct = side === "long"
        ? (currentPrice - bestPrice) / bestPrice * 100
        : (bestPrice - currentPrice) / bestPrice * 100;

      if (trailPnlPct <= -rules.trailingDistancePct) {
        const trailPrice = side === "long"
          ? bestPrice * (1 - rules.trailingDistancePct / 100)
          : bestPrice * (1 + rules.trailingDistancePct / 100);
        return { shouldClose: true, exitPrice: trailPrice, reason: "trailing_stop" };
      }
    }
  }

  // 4. Time Exit
  const openedAt = new Date(trade.openedAt).getTime();
  const now = Date.now();
  const hoursOpen = (now - openedAt) / (1000 * 60 * 60);
  if (hoursOpen >= rules.timeExitHours) {
    return { shouldClose: true, exitPrice: currentPrice, reason: "time_exit" };
  }

  return { shouldClose: false, exitPrice: 0, reason: "" };
}

export async function openPaperTrade(
  decisionJournalId: number,
  strategyId: number,
  asset: string,
  side: "long" | "short",
  entryPrice: number,
  positionSize: number
): Promise<number> {
  const fees = positionSize * FEE_RATE;
  const slippage = positionSize * SLIPPAGE_RATE;

  const result = await db.insert(paperTrades).values({
    decisionJournalId,
    strategyId,
    asset,
    side,
    entryPrice,
    currentPrice: entryPrice,
    simulatedPositionSize: positionSize,
    feesApplied: fees,
    slippageApplied: slippage,
    unrealizedPnl: 0,
    realizedPnl: 0,
    status: "open",
  });

  return Number(result.lastInsertRowid);
}

export async function updatePaperTradePnl(
  tradeId: number
): Promise<{ closed: boolean; reason?: string }> {
  const trade = await db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.id, tradeId))
    .limit(1);

  if (trade.length === 0 || trade[0].status !== "open") return { closed: false };

  const t = trade[0];
  try {
    // Carica candele 15m (ultime 2 ore = 8 candele)
    const candles = await getCandles(t.asset, "15m", new Date(Date.now() - 7200000), new Date(), "bitget");
    if (candles.length === 0) return { closed: false };

    const currentPrice = candles[candles.length - 1].close;

    const allPrices = [
      ...candles.flatMap(c => [c.high, c.low]),
      currentPrice,
      t.entryPrice,
    ];
    const highestPrice = Math.max(...allPrices);
    const lowestPrice = Math.min(...allPrices);

    const unrealizedPnl = t.side === "long"
      ? (currentPrice - t.entryPrice) / t.entryPrice * t.simulatedPositionSize
      : (t.entryPrice - currentPrice) / t.entryPrice * t.simulatedPositionSize;

    await db
      .update(paperTrades)
      .set({
        currentPrice,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      })
      .where(eq(paperTrades.id, tradeId));

    await db.insert(pnlSnapshots).values({
      paperTradeId: tradeId,
      price: currentPrice,
      pnl: Math.round(unrealizedPnl * 100) / 100,
    });

    // Usa exit rules specifiche della strategia
    const exitRules = await getExitRulesForTrade(tradeId);
    const exitCheck = checkExits(
      { side: t.side as "long" | "short", entryPrice: t.entryPrice, currentPrice, openedAt: t.openedAt },
      exitRules,
      highestPrice,
      lowestPrice,
    );

    // ── Trend Exit: chiudi prima dello SL se il trend è cambiato ──────────
    if (!exitCheck.shouldClose && candles.length >= 210) {
      const trendCloses = candles.map(c => c.close);
      let trendCheck: ReturnType<typeof getTrend>;
      try {
        trendCheck = getTrend(trendCloses, 200);
      } catch {
        trendCheck = "neutral";
      }

      const isTrendSided = trendCheck !== "neutral";
      const pnlPct = t.side === "long"
        ? (currentPrice - t.entryPrice) / t.entryPrice * 100
        : (t.entryPrice - currentPrice) / t.entryPrice * 100;

      if (isTrendSided) {
        // LONG in bearish trend → chiudi se il trade è già in negativo
        if (t.side === "long" && trendCheck === "bearish" && pnlPct < -1.0) {
          await closePaperTrade(tradeId, currentPrice);
          const closedTrade2 = await db.select().from(paperTrades).where(eq(paperTrades.id, tradeId)).limit(1);
          if (closedTrade2.length > 0) {
            const ct2 = closedTrade2[0];
            let strategyName2 = "?";
            try { const str2 = await db.select().from(strategies).where(eq(strategies.id, ct2.strategyId)).limit(1); if (str2.length > 0) strategyName2 = str2[0].name; } catch {}
            await sendTelegram(formatTradeClose(tradeId, ct2.asset, ct2.side as "long" | "short", t.entryPrice, currentPrice, ct2.realizedPnl || 0, "trend_exit", strategyName2));
          }
          return { closed: true, reason: "trend_exit" };
        }
        // SHORT in bullish trend → chiudi se il trade è già in negativo
        if (t.side === "short" && trendCheck === "bullish" && pnlPct < -1.0) {
          await closePaperTrade(tradeId, currentPrice);
          const closedTrade3 = await db.select().from(paperTrades).where(eq(paperTrades.id, tradeId)).limit(1);
          if (closedTrade3.length > 0) {
            const ct3 = closedTrade3[0];
            let strategyName3 = "?";
            try { const str3 = await db.select().from(strategies).where(eq(strategies.id, ct3.strategyId)).limit(1); if (str3.length > 0) strategyName3 = str3[0].name; } catch {}
            await sendTelegram(formatTradeClose(tradeId, ct3.asset, ct3.side as "long" | "short", t.entryPrice, currentPrice, ct3.realizedPnl || 0, "trend_exit", strategyName3));
          }
          return { closed: true, reason: "trend_exit" };
        }
      }
    }

    if (exitCheck.shouldClose) {
      await closePaperTrade(tradeId, exitCheck.exitPrice);

      // Notifica Telegram per la chiusura
      const closedTrade = await db
        .select()
        .from(paperTrades)
        .where(eq(paperTrades.id, tradeId))
        .limit(1);
      if (closedTrade.length > 0) {
        const ct = closedTrade[0];
        // Recupera il nome della strategia
        let strategyName = "?";
        try {
          const strat = await db
            .select()
            .from(strategies)
            .where(eq(strategies.id, ct.strategyId))
            .limit(1);
          if (strat.length > 0) strategyName = strat[0].name;
        } catch {}
        const netPnl = ct.realizedPnl || 0;
        await sendTelegram(formatTradeClose(
          tradeId, ct.asset, ct.side, ct.entryPrice, exitCheck.exitPrice, netPnl, exitCheck.reason, strategyName
        ));
      }

      return { closed: true, reason: exitCheck.reason };
    }

    return { closed: false };
  } catch (err) {
    console.error(`[PaperTrade ${tradeId}] Error updating PnL:`, err);
    return { closed: false };
  }
}

export async function closePaperTrade(
  tradeId: number,
  exitPrice: number
): Promise<void> {
  const trade = await db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.id, tradeId))
    .limit(1);

  if (trade.length === 0) return;

  const t = trade[0];
  const realizedPnl = t.side === "long"
    ? (exitPrice - t.entryPrice) / t.entryPrice * t.simulatedPositionSize
    : (t.entryPrice - exitPrice) / t.entryPrice * t.simulatedPositionSize;

  const totalFees = t.simulatedPositionSize * FEE_RATE * 2;
  const netPnl = realizedPnl - totalFees - (t.slippageApplied || 0);

  await db
    .update(paperTrades)
    .set({
      currentPrice: exitPrice,
      realizedPnl: Math.round(netPnl * 100) / 100,
      unrealizedPnl: 0,
      status: "closed",
      closedAt: new Date().toISOString(),
    })
    .where(eq(paperTrades.id, tradeId));
}

export async function updateAllOpenPnL(): Promise<{ total: number; count: number; closed: number }> {
  const openTrades = await db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.status, "open"));

  let totalPnl = 0;
  let closed = 0;
  for (const trade of openTrades) {
    const result = await updatePaperTradePnl(trade.id);
    if (result.closed) {
      console.log(`  🔒 Trade #${trade.id} chiuso: ${result.reason}`);
      closed++;
    }
    totalPnl += trade.unrealizedPnl || 0;
  }

  return { total: Math.round(totalPnl * 100) / 100, count: openTrades.length, closed };
}

export async function getTotalPaperPnl(): Promise<{
  realized: number;
  unrealized: number;
  total: number;
}> {
  const allTrades = await db.select().from(paperTrades);

  let realized = 0;
  let unrealized = 0;

  for (const t of allTrades) {
    realized += t.realizedPnl || 0;
    if (t.status === "open") {
      unrealized += t.unrealizedPnl || 0;
    }
  }

  return {
    realized: Math.round(realized * 100) / 100,
    unrealized: Math.round(unrealized * 100) / 100,
    total: Math.round((realized + unrealized) * 100) / 100,
  };
}

export async function forceCloseStaleTrades(): Promise<number> {
  const openTrades = await db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.status, "open"));

  // Pre-carica strategie per risalire al nome
  const allStrats = db.select().from(strategies).all();

  let closed = 0;
  for (const t of openTrades) {
    const openedAt = new Date(t.openedAt).getTime();
    const hoursOpen = (Date.now() - openedAt) / (1000 * 60 * 60);
    if (hoursOpen >= 48) {
      await closePaperTrade(t.id, t.currentPrice);
      console.log(`  🔒 Trade #${t.id} ${t.asset} ${t.side} chiuso forzatamente (stale — ${Math.round(hoursOpen)}h)`);

      // Notifica Telegram
      const stratName = allStrats.find(s => s.id === t.strategyId)?.name || "?";
      const pnl = t.realizedPnl || 0;
      await sendTelegram(formatTradeClose(t.id, t.asset, t.side as "long" | "short", t.entryPrice, t.currentPrice, pnl, "stale_time_exit", stratName));

      closed++;
    }
  }
  return closed;
}