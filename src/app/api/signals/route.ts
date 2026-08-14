import db, { strategySignals, strategies } from "@/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const signals = await db
    .select()
    .from(strategySignals)
    .orderBy(desc(strategySignals.createdAt))
    .limit(100);

  // Enrich with strategy names
  const enriched = [];
  for (const s of signals) {
    const strat = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, s.strategyId))
      .limit(1);
    enriched.push({
      ...s,
      strategyName: strat.length > 0 ? strat[0].name : "Unknown",
    });
  }

  return NextResponse.json(enriched);
}