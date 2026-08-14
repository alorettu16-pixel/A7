import db, { paperTrades, strategies, riskLimits } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  // Statistiche globali
  const allClosed = db.select().from(paperTrades).where(eq(paperTrades.status, "closed")).all();
  const allOpen = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
  const limits = await db.select().from(riskLimits).limit(1);
  const budget = limits.length > 0 ? limits[0].demoBudgetUsd : 500;

  const totalPnl = allClosed.reduce((s, t) => s + (t.realizedPnl || 0), 0);
  const openPnl = allOpen.reduce((s, t) => s + (t.unrealizedPnl || 0), 0);
  const wins = allClosed.filter(t => (t.realizedPnl || 0) > 0).length;
  const winRate = allClosed.length > 0 ? wins / allClosed.length : 0;

  // Performance per strategia
  const activeStrats = await db.select().from(strategies).where(eq(strategies.status, "paper_active"));

  const stratStats = [];
  for (const s of activeStrats) {
    const trades = allClosed.filter(t => t.strategyId === s.id);
    const open = allOpen.filter(t => t.strategyId === s.id);
    const pnl = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const w = trades.filter(t => (t.realizedPnl || 0) > 0).length;
    const l = trades.filter(t => (t.realizedPnl || 0) < 0).length;
    const avgPnl = trades.length > 0 ? pnl / trades.length : 0;
    const best = trades.length > 0 ? Math.max(...trades.map(t => t.realizedPnl || 0)) : 0;
    const worst = trades.length > 0 ? Math.min(...trades.map(t => t.realizedPnl || 0)) : 0;

    stratStats.push({
      id: s.id,
      name: s.name,
      category: s.category,
      tradeCount: trades.length,
      openCount: open.length,
      totalPnl: Math.round(pnl * 100) / 100,
      winRate: trades.length > 0 ? Math.round(w / trades.length * 100) / 100 : 0,
      winCount: w,
      lossCount: l,
      avgPnl: Math.round(avgPnl * 100) / 100,
      bestTrade: Math.round(best * 100) / 100,
      worstTrade: Math.round(worst * 100) / 100,
    });
  }

  // Performance per asset
  const assetMap: Record<string, { trades: number; wins: number; pnl: number }> = {};
  for (const t of allClosed) {
    if (!assetMap[t.asset]) assetMap[t.asset] = { trades: 0, wins: 0, pnl: 0 };
    assetMap[t.asset].trades++;
    assetMap[t.asset].pnl += t.realizedPnl || 0;
    if ((t.realizedPnl || 0) > 0) assetMap[t.asset].wins++;
  }

  const assetStats = Object.entries(assetMap).map(([asset, stats]) => ({
    asset,
    tradeCount: stats.trades,
    winRate: stats.trades > 0 ? Math.round(stats.wins / stats.trades * 100) / 100 : 0,
    totalPnl: Math.round(stats.pnl * 100) / 100,
  })).sort((a, b) => b.totalPnl - a.totalPnl);

  return NextResponse.json({
    budget,
    totalClosed: allClosed.length,
    totalOpen: allOpen.length,
    totalPnl: Math.round(totalPnl * 100) / 100,
    openPnl: Math.round(openPnl * 100) / 100,
    winRate: Math.round(winRate * 10000) / 100,
    strategies: stratStats.sort((a, b) => b.totalPnl - a.totalPnl),
    assets: assetStats,
  });
}