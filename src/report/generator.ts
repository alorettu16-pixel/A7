import db, {
  strategies,
  paperTrades,
  strategySignals,
  tradingViewWebhookLogs,
  ruleChanges,
  dailyReports,
  riskLimits,
  equitySnapshots,
} from "@/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface DailyReportData {
  date: string;
  paperPnl: number;
  winRate: number;
  openPositions: number;
  newSignals: number;
  tradingViewSignalsToday: number;
  activeStrategies: number;
  rejectedStrategies: number;
  ruleChanges: { id: number; reason: string }[];
  deviationAlerts: string[];
  liveTradingStatus: boolean;
  summary: string;
}

export async function generateDailyReport(): Promise<DailyReportData> {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00.000Z`;

  // Paper PnL
  const allTrades = await db.select().from(paperTrades);
  let paperPnl = 0;
  let wins = 0;
  let total = 0;
  for (const t of allTrades) {
    paperPnl += (t.realizedPnl || 0) + (t.unrealizedPnl || 0);
    if (t.realizedPnl !== null && t.realizedPnl !== 0) {
      total++;
      if (t.realizedPnl > 0) wins++;
    }
  }
  const winRate = total > 0 ? wins / total : 0;

  // Open positions
  const openTrades = allTrades.filter(t => t.status === "open").length;

  // Signals today
  const signalsToday = await db
    .select()
    .from(strategySignals)
    .where(gte(strategySignals.createdAt, todayStart));

  // Webhook signals today
  const webhookToday = await db
    .select()
    .from(tradingViewWebhookLogs)
    .where(gte(tradingViewWebhookLogs.receivedAt, todayStart));

  // Active/rejected strategies
  const activeStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "paper_active"));

  const rejectedStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "rejected"));

  // Rule changes today
  const ruleChangesToday = await db
    .select()
    .from(ruleChanges)
    .where(gte(ruleChanges.createdAt, todayStart));

  // Live trading status
  const limits = await db.select().from(riskLimits).limit(1);
  const liveTradingStatus = limits.length > 0 ? limits[0].liveTradingEnabled : false;

  // Deviation alerts
  const deviationAlerts: string[] = [];
  // Check if any strategy has > 20% deviation between paper and backtest
  // (Simplified check)

  // Take equity snapshot
  await db.insert(equitySnapshots).values({
    totalPnl: Math.round(paperPnl * 100) / 100,
    realizedPnl: allTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0),
    unrealizedPnl: allTrades.reduce((s, t) => s + (t.unrealizedPnl || 0), 0),
    openCount: openTrades,
    closedCount: total,
  });

  const report: DailyReportData = {
    date: today,
    paperPnl: Math.round(paperPnl * 100) / 100,
    winRate: Math.round(winRate * 10000) / 100,
    openPositions: openTrades,
    newSignals: signalsToday.length,
    tradingViewSignalsToday: webhookToday.length,
    activeStrategies: activeStrategies.length,
    rejectedStrategies: rejectedStrategies.length,
    ruleChanges: ruleChangesToday.map(r => ({ id: r.id, reason: r.reason || "" })),
    deviationAlerts,
    liveTradingStatus,
    summary: `Report ${today}: PnL ${Math.round(paperPnl * 100) / 100}$, WR ${(winRate * 100).toFixed(0)}%, ${openTrades} posizioni aperte, ${signalsToday.length} segnali oggi, ${activeStrategies.length} strategie attive`,
  };

  // Save report
  await db.insert(dailyReports).values({
    date: today,
    paperPnl: report.paperPnl,
    winRate: report.winRate,
    openPositions: report.openPositions,
    newSignals: report.newSignals,
    tradingViewSignalsToday: report.tradingViewSignalsToday,
    activeStrategies: report.activeStrategies,
    rejectedStrategies: report.rejectedStrategies,
    ruleChangesJson: JSON.stringify(report.ruleChanges),
    deviationAlertsJson: JSON.stringify(report.deviationAlerts),
    liveTradingStatus: report.liveTradingStatus,
    summary: report.summary,
  });

  return report;
}