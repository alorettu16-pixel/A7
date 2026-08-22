import db, { decisionJournal, paperTrades, strategies } from "@/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const allSignals = await db
    .select()
    .from(decisionJournal)
    .orderBy(desc(decisionJournal.createdAt))
    .limit(100);

  // Enrich with strategy names + asset from paperTrades
  const enriched = [];
  for (const s of allSignals) {
    const strat = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, s.strategyId))
      .limit(1);

    // Cerca il trade associato per risalire ad asset e side
    const trade = await db
      .select()
      .from(paperTrades)
      .where(eq(paperTrades.decisionJournalId, s.id))
      .limit(1);

    let reasons: string[] = [];
    try { reasons = JSON.parse(s.reasonsJson || "[]"); } catch {}
    enriched.push({
      id: s.id,
      strategyId: s.strategyId,
      asset: trade.length > 0 ? trade[0].asset : "?",
      side: trade.length > 0 ? trade[0].side : (s.decision === "paper_copy" ? "long" : "short"),
      signalPrice: trade.length > 0 ? trade[0].entryPrice : 0,
      timestamp: s.createdAt,
      origin: "Interno",
      strategyName: strat.length > 0 ? strat[0].name : "Unknown",
      confidence: s.confidenceScore,
      reason: reasons[0] || "",
    });
  }

  return NextResponse.json(enriched);
}