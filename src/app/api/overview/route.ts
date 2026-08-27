import db, { strategies, paperTrades, decisionJournal, tradingViewWebhookLogs, riskLimits, equitySnapshots } from "@/db";
import { eq, desc, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const allTrades = await db.select().from(paperTrades);
  let totalPnl = 0, realizedPnl = 0, unrealizedPnl = 0;
  for (const t of allTrades) {
    realizedPnl += t.realizedPnl || 0;
    if (t.status === "open") unrealizedPnl += t.unrealizedPnl || 0;
  }
  totalPnl = realizedPnl + unrealizedPnl;

  const closedTrades = allTrades.filter(t => t.status === "closed");
  const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
  const losses = closedTrades.filter(t => (t.realizedPnl || 0) < 0).length;
  const winRate = closedTrades.length > 0 ? wins / closedTrades.length * 100 : 0;

  const active = await db.select().from(strategies).where(eq(strategies.status, "paper_active"));
  const openPositions = allTrades.filter(t => t.status === "open").length;

  const todayStart = new Date().toISOString().split("T")[0] + " 00:00:00";
  const signalsToday = await db.select().from(decisionJournal).where(gte(decisionJournal.createdAt, todayStart));
  const webhookToday = await db.select().from(tradingViewWebhookLogs).where(gte(tradingViewWebhookLogs.receivedAt, todayStart));

  const totalStrategies = await db.select().from(strategies);
  const hasStrategies = totalStrategies.length > 0;

  const limits = await db.select().from(riskLimits).limit(1);
  const liveTradingEnabled = limits.length > 0 ? limits[0].liveTradingEnabled : false;
  const budgetDemo = limits.length > 0 ? limits[0].demoBudgetUsd : 10000;

  // Esposizione totale (somma size posizioni aperte)
  const openTradeList = allTrades.filter(t => t.status === "open");
  const totalExposure = openTradeList.reduce((sum, t) => sum + (t.simulatedPositionSize || 0), 0);

  const snapshots = await db
    .select()
    .from(equitySnapshots)
    .orderBy(desc(equitySnapshots.snapshotAt))
    .limit(50);

  return NextResponse.json({
    hasStrategies,
    totalPnl: Math.round(totalPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalBudget: Math.round((budgetDemo + realizedPnl) * 100) / 100,
    activeStrategies: active.length,
    openPositions,
    totalExposure: Math.round(totalExposure * 100) / 100,
    signalsToday: signalsToday.length,
    webhooksToday: webhookToday.length,
    liveTradingEnabled,
    budgetDemo: Math.round(budgetDemo * 100) / 100,
    totalClosed: closedTrades.length,
    totalOpen: allTrades.filter(t => t.status === "open").length,
    winCount: wins,
    lossCount: losses,
    winRate: Math.round(winRate * 100) / 100,
    avgDeviation: 0,
    equityCurve: snapshots.reverse().map(s => ({
      time: s.snapshotAt,
      equity: s.totalPnl,
    })),
  });
}