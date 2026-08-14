import db, { outcomeReviews, paperTrades, backtestRuns, strategies } from "@/db";
import { eq, and, desc } from "drizzle-orm";

export interface ReviewResult {
  tradeId: number;
  decisionJournalId: number;
  finalOutcome: "win" | "loss" | "breakeven";
  simulatedPnl: number;
  wasDecisionGood: boolean;
  deviationFromBacktest: number | null;
}

export async function reviewOutcomes(): Promise<ReviewResult[]> {
  const closedTrades = await db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.status, "closed"));

  const results: ReviewResult[] = [];

  for (const trade of closedTrades) {
    // Check if already reviewed
    const existing = await db
      .select()
      .from(outcomeReviews)
      .where(eq(outcomeReviews.paperTradeId, trade.id))
      .limit(1);

    if (existing.length > 0) continue;

    const realizedPnl = trade.realizedPnl || 0;
    const finalOutcome: "win" | "loss" | "breakeven" =
      realizedPnl > 0 ? "win" : realizedPnl < 0 ? "loss" : "breakeven";
    const wasDecisionGood = realizedPnl >= 0;

    // Find latest backtest for this strategy to compare
    const latestBacktest = await db
      .select()
      .from(backtestRuns)
      .where(
        and(
          eq(backtestRuns.strategyId, trade.strategyId),
          eq(backtestRuns.isOutOfSample, true)
        )
      )
      .orderBy(desc(backtestRuns.createdAt))
      .limit(1);

    let deviationFromBacktest: number | null = null;
    if (latestBacktest.length > 0 && latestBacktest[0].winRate && latestBacktest[0].winRate > 0) {
      // Compare this trade's outcome vs expected win rate
      deviationFromBacktest = realizedPnl > 0 ? 1 : 0;
      // Simplified: if backtest win rate is 60% and this trade lost, that's a deviation
    }

    await db.insert(outcomeReviews).values({
      decisionJournalId: trade.decisionJournalId || undefined,
      paperTradeId: trade.id,
      finalOutcome,
      simulatedPnl: realizedPnl,
      wasDecisionGood,
      deviationFromBacktest,
      lessonsJson: JSON.stringify({
        deviation: deviationFromBacktest,
        strategyId: trade.strategyId,
        asset: trade.asset,
        side: trade.side,
      }),
    });

    results.push({
      tradeId: trade.id,
      decisionJournalId: trade.decisionJournalId || 0,
      finalOutcome,
      simulatedPnl: realizedPnl,
      wasDecisionGood,
      deviationFromBacktest,
    });
  }

  return results;
}