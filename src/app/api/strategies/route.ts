import db, { strategies, backtestRuns, backtestTrades } from "@/db";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const allStrategies = await db
    .select()
    .from(strategies)
    .orderBy(desc(strategies.createdAt));

  const result = [];
  for (const s of allStrategies) {
    const latestBacktest = await db
      .select()
      .from(backtestRuns)
      .where(eq(backtestRuns.strategyId, s.id))
      .orderBy(desc(backtestRuns.createdAt))
      .limit(1);

    result.push({
      ...s,
      latestBacktest: latestBacktest[0] || null,
    });
  }

  return NextResponse.json(result);
}

// ─── PATCH: toggla lo status di una strategia (paper_active ↔ research) ───
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id e status richiesti" }, { status: 400 });
    }

    const validStatuses = ["research", "backtesting", "paper_active", "watch", "rejected", "live_eligible"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status non valido: ${status}` }, { status: 400 });
    }

    await db.update(strategies).set({ status }).where(eq(strategies.id, id)).run();

    return NextResponse.json({ ok: true, id, status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, entryRules, exitRules, parameters } = body;

    if (!name) {
      return NextResponse.json({ error: "Nome strategia richiesto" }, { status: 400 });
    }

    const res = await db.insert(strategies).values({
      name,
      source: "builder",
      category: category || "custom",
      sourceDescription: `Strategia creata manualmente tramite Builder. Regole: ${JSON.stringify(entryRules)}`,
      entryRulesJson: JSON.stringify(entryRules || []),
      exitRulesJson: JSON.stringify(exitRules || []),
      parametersJson: JSON.stringify(parameters || {}),
      status: "research",
      isDemo: true,
    });

    return NextResponse.json({ id: Number(res.lastInsertRowid), name }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}