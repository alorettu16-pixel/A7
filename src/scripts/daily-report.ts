import db, { paperTrades, strategies, dailyReports, equitySnapshots } from "@/db";
import { eq, gte, sql } from "drizzle-orm";
import { sendTelegram, formatStatus } from "@/lib/telegram";

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(today + "T00:00:00Z");
  const todayEnd = new Date(today + "T23:59:59Z");

  // ─── Strategie attive ─────────────────────────────────
  const active = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();

  // ─── Trades di oggi ────────────────────────────────────
  const allTrades = db.select().from(paperTrades).all();
  const todayTrades = allTrades.filter(t => {
    const d = new Date(t.closedAt || t.openedAt);
    return d >= todayStart && d <= todayEnd;
  });
  const openTrades = allTrades.filter(t => t.status === "open");
  const closedTrades = allTrades.filter(t => t.status === "closed");

  // ─── PnL ───────────────────────────────────────────────
  const realizedPnl = allTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0);
  const openPnl = openTrades.reduce((s, t) => s + (t.unrealizedPnl || 0), 0);
  const totalPnl = realizedPnl + openPnl;
  const todayPnl = todayTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0);
  const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
  const losses = closedTrades.filter(t => (t.realizedPnl || 0) < 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length * 100).toFixed(1) : "N/A";

  const exposure = openTrades.reduce((s, t) => s + (t.simulatedPositionSize || 0), 0);

  // ─── Raggruppa per strategia ────────────────────────────
  const byStrategy: Record<number, { name: string; opened: number; closed: number; pnl: number }> = {};
  for (const t of allTrades) {
    const strat = active.find(s => s.id === t.strategyId);
    const name = strat?.name || "?";
    if (!byStrategy[t.strategyId]) byStrategy[t.strategyId] = { name, opened: 0, closed: 0, pnl: 0 };
    if (t.status === "closed") {
      byStrategy[t.strategyId].closed++;
      byStrategy[t.strategyId].pnl += t.realizedPnl || 0;
    } else {
      byStrategy[t.strategyId].opened++;
    }
  }

  // ─── Salva report ──────────────────────────────────────
  // Verifica se esiste già un report per oggi
  const existing = db.select().from(dailyReports).where(eq(dailyReports.date, today)).limit(1).all();
  if (existing.length > 0) {
    db.update(dailyReports).set({
      paperPnl: totalPnl,
      winRate: winRate !== "N/A" ? parseFloat(winRate) : undefined,
      openPositions: openTrades.length,
      newSignals: todayTrades.length,
      activeStrategies: active.length,
    }).where(eq(dailyReports.date, today)).run();
    console.log("📝 Report aggiornato per", today);
  } else {
    db.insert(dailyReports).values({
      date: today,
      paperPnl: totalPnl,
      winRate: winRate !== "N/A" ? parseFloat(winRate) : undefined,
      openPositions: openTrades.length,
      newSignals: todayTrades.length,
      activeStrategies: active.length,
      summary: JSON.stringify(byStrategy),
    }).run();
    console.log("✅ Report creato per", today);
  }

  // ─── Equity snapshot ──────────────────────────────────
  db.insert(equitySnapshots).values({
    totalPnl: realizedPnl + openPnl,
    realizedPnl: realizedPnl,
    unrealizedPnl: openPnl,
    openCount: openTrades.length,
    closedCount: closedTrades.length,
  }).run();

  // ─── Report su Telegram ────────────────────────────────
  const msg = [
    `📋 *A7 — Report Giornaliero*`,
    `📅 ${today}`,
    ``,
    `📊 Strategie attive: ${active.length}`,
    `💼 Posizioni aperte: ${openTrades.length} (esposizione ${exposure.toFixed(0)}$)`,
    `📉 Trades chiusi: ${closedTrades.length} (win ${wins}, loss ${losses}, WR ${winRate}%)`,
    `💰 PnL realizzato: ${totalPnl >= 0 ? "🟢" : "🔴"} ${totalPnl.toFixed(2)}$`,
    `📈 Oggi: ${todayPnl >= 0 ? "🟢" : "🔴"} ${todayPnl.toFixed(2)}$`,
    `📊 PnL flottante: ${openPnl.toFixed(2)}$`,
    ``,
    `*Dettaglio per strategia:*`,
    ...Object.values(byStrategy).map(s =>
      `  ${s.name.slice(0, 30)}: ${s.opened} attivi, ${s.closed} chiusi, PnL ${s.pnl.toFixed(1)}$`
    ),
  ].join("\n");

  await sendTelegram(msg);
  console.log("📨 Report inviato su Telegram");
}

main().catch(console.error);