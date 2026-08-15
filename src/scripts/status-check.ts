import db, { paperTrades, strategies, strategySignals, riskLimits } from "@/db";
import { eq, gte, sql } from "drizzle-orm";
import { sendTelegram, formatStatus } from "@/lib/telegram";

async function main() {
  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  A7 — Status Check");
  console.log("═══════════════════════════════════════════");

  // ─── Ora ──────────────────────────────────────────────
  const now = new Date();
  const row: any = db.all(sql`SELECT datetime('now') as t`);
  const serverTime = row?.[0]?.t ?? now.toISOString();
  console.log(`\n⏰ Ora sistema: ${now.toLocaleString("it-IT", { timeZone: "UTC" })} UTC`);
  console.log(`   DB time:     ${serverTime}`);

  // ─── Strategie attive ─────────────────────────────────
  const active = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
  console.log(`\n📊 Strategie paper_active: ${active.length}`);
  for (const s of active) {
    console.log(`   ✅ ${s.name}`);
  }

  // ─── Posizioni aperte ─────────────────────────────────
  const openTrades = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
  console.log(`\n💼 Posizioni aperte: ${openTrades.length}`);
  let totalExposure = 0;
  for (const t of openTrades) {
    const pnl = (t.unrealizedPnl || 0) + (t.realizedPnl || 0);
    totalExposure += t.simulatedPositionSize || 0;
    const arrow = pnl > 0 ? "🟢" : pnl < 0 ? "🔴" : "⚪";
    console.log(`   ${arrow} #${t.id} ${t.asset} ${t.side} | entry=${t.entryPrice} curr=${t.currentPrice} | size=${t.simulatedPositionSize}$ | uPnL=${t.unrealizedPnl ?? 0}$ rPnL=${t.realizedPnl ?? 0}$`);
  }
  if (openTrades.length === 0) console.log(`   (nessuna)`);

  // ─── Esposizione ──────────────────────────────────────
  const limits = db.select().from(riskLimits).limit(1).all();
  const risk = limits[0];
  if (risk) {
    console.log(`\n🛡 Esposizione: ${totalExposure.toFixed(2)}$ / ${risk.maxTotalExposureUsd}$`);
    if (totalExposure >= risk.maxTotalExposureUsd) console.log(`   ⚠️  LIMITE RAGGIUNTO — nessun nuovo segnale`);
    console.log(`   Max posizione: ${risk.maxPositionSizeUsd}$, Drawdown max: ${risk.maxDailyDrawdownPct}%`);
    console.log(`   Live trading: ${risk.liveTradingEnabled ? "✅ ATTIVO" : "❌ Disabilitato (paper)"}`);
    if (risk.killSwitchActive) console.log(`   🛑 KILL SWITCH ATTIVO`);
  }

  // ─── Segnali oggi ─────────────────────────────────────
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const signalsToday = db.select().from(strategySignals).where(gte(strategySignals.createdAt, today.toISOString())).all();
  console.log(`\n📡 Segnali oggi: ${signalsToday.length}`);
  for (const s of signalsToday.slice(-5)) {
    const strat = active.find(a => a.id === s.strategyId);
    console.log(`   ${s.side === "long" ? "📈" : "📉"} ${s.asset} ${s.side} @ ${s.signalPrice} — ${strat?.name || "?"}`);
  }

  // ─── PnL totale ───────────────────────────────────────
  const allTrades = db.select().from(paperTrades).all();
  const totalPnl = allTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0);
  const openPnl = openTrades.reduce((s, t) => s + (t.unrealizedPnl || 0), 0);
  const wins = allTrades.filter(t => (t.realizedPnl || 0) > 0).length;
  const losses = allTrades.filter(t => (t.realizedPnl || 0) < 0).length;
  const closed = allTrades.filter(t => t.status === "closed");
  const winRate = closed.length > 0 ? (closed.filter(t => (t.realizedPnl || 0) > 0).length / closed.length * 100).toFixed(1) : "N/A";

  console.log(`\n💰 PnL realizzato: ${totalPnl.toFixed(2)}$`);
  console.log(`   PnL non realizzato: ${openPnl.toFixed(2)}$`);
  console.log(`   Trades chiusi: ${closed.length} (win ${wins}, loss ${losses}, win rate ${winRate}%)`);

  // ─── Cron check ────────────────────────────────────────
  const dbTime = new Date(serverTime + "Z");
  const lastSignal = signalsToday.length > 0
    ? new Date(signalsToday[signalsToday.length - 1].createdAt + "Z")
    : null;
  if (lastSignal) {
    const minutesAgo = Math.round((dbTime.getTime() - lastSignal.getTime()) / 60000);
    console.log(`\n⏱ Ultimo segnale: ${minutesAgo} min fa`);
    if (minutesAgo > 60) console.log(`   ⚠️  Possibile — nessun segnale da oltre 1h`);
  } else {
    console.log(`\n⏱ Ultimo segnale: mai`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Consigli veloci:");
  console.log("  npm run signals:generate   — genera segnali");
  console.log("  npm run paper:update-pnl   — aggiorna PnL posizioni aperte");
  console.log("  npm run full-cycle          — tutto in una volta");
  console.log("  npm run go                 — status + full-cycle + status");
  console.log("═══════════════════════════════════════════\n");

  // ─── Telegram report orario ────────────────────────────
  // Inviato solo se esplicitamente richiesto via env TELEGRAM_REPORT=1
  // (dal cron orario "0 * * * *" che esegue TELEGRAM_REPORT=1 npm run status)
  if (process.env.TELEGRAM_REPORT === "1") {
    const closedTrades = allTrades.filter(t => t.status === "closed");
    const totalWins = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
    const msg = formatStatus(
      active.length,
      openTrades.length,
      openTrades.reduce((s, t) => s + (t.simulatedPositionSize || 0), 0),
      risk?.maxTotalExposureUsd || 10000,
      totalPnl,
      openPnl,
      closedTrades.length,
      totalWins
    );
    await sendTelegram(msg);
  }
}

main().catch(console.error);