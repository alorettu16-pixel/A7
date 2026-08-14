import db, { decisionJournal, strategies, strategySignals } from "@/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const entries = await db.select().from(decisionJournal).orderBy(desc(decisionJournal.createdAt)).limit(100);
  const enriched = [];
  for (const e of entries) {
    const strat = await db.select().from(strategies).where(eq(strategies.id, e.strategyId)).limit(1);
    const sig = e.strategySignalId ? await db.select().from(strategySignals).where(eq(strategySignals.id, e.strategySignalId)).limit(1) : [];
    enriched.push({ ...e, strategyName: strat[0]?.name || null, signalAsset: sig[0]?.asset || null, signalSide: sig[0]?.side || null });
  }
  return NextResponse.json(enriched);
}