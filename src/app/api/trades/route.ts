import db, { paperTrades, strategies, decisionJournal, pnlSnapshots } from "@/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const trades = await db
    .select()
    .from(paperTrades)
    .orderBy(desc(paperTrades.openedAt))
    .limit(100);

  const enriched = [];
  for (const t of trades) {
    const strat = await db.select().from(strategies).where(eq(strategies.id, t.strategyId)).limit(1);
    const dj = t.decisionJournalId ? await db.select().from(decisionJournal).where(eq(decisionJournal.id, t.decisionJournalId)).limit(1) : [];
    const snapshots = await db.select().from(pnlSnapshots).where(eq(pnlSnapshots.paperTradeId, t.id)).orderBy(desc(pnlSnapshots.collectedAt)).limit(50);

    // Extract timeExitHours + SL/TP from strategy parameters
    let timeExitHours = 96;
    let slPct = 2;
    let tpPct = 4;
    if (strat[0]?.parametersJson) {
      try {
        const params = JSON.parse(strat[0].parametersJson);
        timeExitHours = params.timeExitHours ?? 96;
        slPct = params.sl ?? 2;
        tpPct = params.tp ?? 4;
      } catch {}
    }

    enriched.push({
      ...t,
      strategyName: strat[0]?.name || "Sconosciuta",
      decisionPnl: dj[0]?.decision || null,
      pnlCurve: snapshots.reverse().map(s => ({ time: s.collectedAt, pnl: s.pnl })),
      timeExitHours,
      slPct,
      tpPct,
    });
  }

  return NextResponse.json(enriched);
}