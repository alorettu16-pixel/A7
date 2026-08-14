import db, { backtestRuns, strategies } from "@/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const all = await db.select().from(backtestRuns).orderBy(desc(backtestRuns.createdAt)).limit(200);
  const enriched = [];
  for (const b of all) {
    const s = await db.select().from(strategies).where(eq(strategies.id, b.strategyId)).limit(1);
    enriched.push({ ...b, strategyName: s[0]?.name || "Sconosciuta" });
  }
  return NextResponse.json(enriched);
}