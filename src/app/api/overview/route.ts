import db, { strategies, paperTrades, decisionJournal, tradingViewWebhookLogs, riskLimits, equitySnapshots, dailyReports } from "@/db";
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

  // ─── PnL chiusura giorno precedente (dal report giornaliero) ───────────
  const todayStr = new Date().toISOString().split("T")[0];
  const prevDayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  let prevDayClosePnl = null;
  try {
    const prevReport = await db
      .select()
      .from(dailyReports)
      .where(eq(dailyReports.date, prevDayStr))
      .limit(1);
    if (prevReport.length > 0 && prevReport[0].paperPnl !== null) {
      prevDayClosePnl = prevReport[0].paperPnl;
    } else {
      // Fallback: primo equitySnapshot prima di oggi
      try {
        const prevSnap = await db
          .select()
          .from(equitySnapshots)
          .where(gte(equitySnapshots.snapshotAt, prevDayStr + " 00:00:00"))
          .orderBy(desc(equitySnapshots.snapshotAt))
          .limit(1);
        // Filtra per data di fine giorno manualmente
        const prevSnapFiltered = prevSnap.filter(s => s.snapshotAt && s.snapshotAt <= prevDayStr + " 23:59:59");
        if (prevSnapFiltered.length > 0) prevDayClosePnl = prevSnapFiltered[0].totalPnl;
      } catch {
        // silenzioso
      }
    }
  } catch {
    // silenzioso
  }

  // Totale budget corrente = budget demo + PnL realizzato
  const totalBudget = budgetDemo + realizedPnl;
  const prevDayTotalBudget = prevDayClosePnl !== null ? budgetDemo + prevDayClosePnl : null;

  // Variazione % e $ rispetto al giorno prima
  let dayChangePct = null;
  let dayChangeValue = null;
  if (prevDayTotalBudget !== null && prevDayTotalBudget !== 0) {
    dayChangePct = ((totalBudget - prevDayTotalBudget) / prevDayTotalBudget) * 100;
    dayChangeValue = totalBudget - prevDayTotalBudget;
  }

  return NextResponse.json({
    hasStrategies,
    totalPnl: Math.round(totalPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalBudget: Math.round(totalBudget * 100) / 100,
    prevDayTotalBudget: prevDayTotalBudget !== null ? Math.round(prevDayTotalBudget * 100) / 100 : null,
    dayChangePct: dayChangePct !== null ? Math.round(dayChangePct * 100) / 100 : null,
    dayChangeValue: dayChangeValue !== null ? Math.round(dayChangeValue * 100) / 100 : null,
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