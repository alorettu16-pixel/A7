import db, { strategies, paperTrades, decisionJournal, tradingViewWebhookLogs, riskLimits, equitySnapshots, dailyReports } from "@/db";
import { eq, desc, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "all"; // 1d, 7d, 30d, 365d, all
  const fromDate = searchParams.get("from"); // ISO date
  const toDate = searchParams.get("to"); // ISO date

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

  const openTradeList = allTrades.filter(t => t.status === "open");
  const totalExposure = openTradeList.reduce((sum, t) => sum + (t.simulatedPositionSize || 0), 0);

  // ─── Equity Snapshots filtrati per range/date ────────────────────────
  let sinceDate: string | null = null;
  const now = new Date();

  if (fromDate) {
    sinceDate = fromDate + " 00:00:00";
  } else if (range !== "all") {
    const days = parseInt(range.replace("d", ""));
    sinceDate = new Date(now.getTime() - days * 86400000).toISOString().split("T")[0] + " 00:00:00";
  }

  let snapshots;
  if (sinceDate && toDate) {
    snapshots = await db
      .select()
      .from(equitySnapshots)
      .where(gte(equitySnapshots.snapshotAt, sinceDate))
      .orderBy(desc(equitySnapshots.snapshotAt))
      .limit(200);
    snapshots = snapshots.filter(s => s.snapshotAt && s.snapshotAt <= toDate + " 23:59:59");
  } else if (sinceDate) {
    snapshots = await db
      .select()
      .from(equitySnapshots)
      .where(gte(equitySnapshots.snapshotAt, sinceDate))
      .orderBy(desc(equitySnapshots.snapshotAt))
      .limit(200);
  } else {
    snapshots = await db
      .select()
      .from(equitySnapshots)
      .orderBy(desc(equitySnapshots.snapshotAt))
      .limit(200);
  }

  // ─── Variazioni per periodo ────────────────────────────────────────
  // Calcola le variazioni su tutti gli snapshot disponibili
  const allSnapshots = await db
    .select()
    .from(equitySnapshots)
    .orderBy(desc(equitySnapshots.snapshotAt))
    .limit(400);

  function getSnapshotAtOffset(daysAgo: number): number | null {
    const target = new Date(now.getTime() - daysAgo * 86400000).toISOString().split("T")[0];
    for (const s of allSnapshots) {
      if (s.snapshotAt && s.snapshotAt.startsWith(target)) return s.totalPnl;
    }
    return null;
  }

  const currentTotal = budgetDemo + realizedPnl;
  const prevDayTotal = getSnapshotAtOffset(1);
  const prevWeekTotal = getSnapshotAtOffset(7);
  const prevMonthTotal = getSnapshotAtOffset(30);
  const prevYearTotal = getSnapshotAtOffset(365);

  function calcChange(basePnl: number | null): { value: number | null; pct: number | null } {
    if (basePnl === null) return { value: null, pct: null };
    const prevBudget = budgetDemo + basePnl;
    if (prevBudget === 0) return { value: null, pct: null };
    return {
      value: Math.round((currentTotal - prevBudget) * 100) / 100,
      pct: Math.round(((currentTotal - prevBudget) / prevBudget) * 10000) / 100,
    };
  }

  const dayChange = calcChange(prevDayTotal);
  const weekChange = calcChange(prevWeekTotal);
  const monthChange = calcChange(prevMonthTotal);
  const yearChange = calcChange(prevYearTotal);

  return NextResponse.json({
    hasStrategies,
    totalPnl: Math.round(totalPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalBudget: Math.round(currentTotal * 100) / 100,
    changes: {
      day: dayChange,
      week: weekChange,
      month: monthChange,
      year: yearChange,
    },
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