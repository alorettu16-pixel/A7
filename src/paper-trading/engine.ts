import db, { paperTrades, pnlSnapshots, strategies } from "@/db";
import { eq, and } from "drizzle-orm";
import { getCandles } from "@/market-data";
import { sendTelegram, formatTradeClose } from "@/lib/telegram";

const FEE_RATE = 0.0006; // 0.06% taker Bitget futures USDT-M
const SLIPPAGE_RATE = 0.0003; // 0.03% slippage

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
 * Legge i parametri SL/TP dalla strategia se presenti, altrimenti usa default
 */
async function getExitRulesForTrade(tradeId: number): Promise<ExitRules> {
  try {
    const trade = db.select().from(paperTrades).where(eq(paperTrades.id, tradeId)).limit(1).get();
    if (!trade) return DEFAULT_EXIT_RULES;

    const strat = db.select().from(strategies).where(eq(strategies.id, trade.strategyId)).limit(1).get();
    if (!strat) return DEFAULT_EXIT_RULES;

    const params = JSON.parse(strat.parametersJson || "{}");

    // Cerca sl/tp nei parametri con vari nomi possibili
    const sl = params.slPct ?? params.sl ?? params.stopLossPct ?? null;
    const tp = params.tpPct ?? params.tp ?? params.takeProfitPct ?? null;

    // time exit dai parametri
    const timeH = params.timeExit ?? params.timeExitHours ?? null;

    return {
      takeProfitPct: tp ?? DEFAULT_EXIT_RULES.takeProfitPct,
      stopLossPct: sl ?? DEFAULT_EXIT_RULES.stopLossPct,
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