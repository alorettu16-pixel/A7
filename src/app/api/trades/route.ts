import db, { paperTrades, strategies, decisionJournal, pnlSnapshots, riskLimits } from "@/db";
import { eq, asc, desc } from "drizzle-orm";
import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get("sort") || "pnl"; // pnl | date | asset
  const sortDir = searchParams.get("dir") || "desc"; // desc | asc
  const filterDate = searchParams.get("date") || ""; // YYYY-MM-DD
  const filterAsset = (searchParams.get("asset") || "").toUpperCase();
  const filterSide = (searchParams.get("side") || "").toLowerCase();
  const filterStatus = (searchParams.get("status") || "").toLowerCase();

  const trades = await db
    .select()
    .from(paperTrades)
    .orderBy(desc(paperTrades.openedAt));

  let filtered = trades;

  // Filtro status
  if (filterStatus === "open" || filterStatus === "closed") {
    filtered = filtered.filter(t => t.status === filterStatus);
  }

  // Filtro data (per trades chiusi)
  if (filterDate) {
    const dayStart = filterDate + "T00:00:00.000Z";
    const dayEnd = filterDate + "T23:59:59.999Z";
    filtered = filtered.filter(t => {
      const d = t.closedAt || t.openedAt;
      return d >= dayStart && d <= dayEnd;
    });
  }

  // Filtro asset
  if (filterAsset) {
    filtered = filtered.filter(t => t.asset.toUpperCase() === filterAsset);
  }

  // Filtro side
  if (filterSide === "long" || filterSide === "short") {
    filtered = filtered.filter(t => t.side === filterSide);
  }

  const enriched = [];
  for (const t of filtered) {
    const strat = await db.select().from(strategies).where(eq(strategies.id, t.strategyId)).limit(1);
    const dj = t.decisionJournalId ? await db.select().from(decisionJournal).where(eq(decisionJournal.id, t.decisionJournalId)).limit(1) : [];
    const snapshots = await db.select().from(pnlSnapshots).where(eq(pnlSnapshots.paperTradeId, t.id)).orderBy(desc(pnlSnapshots.collectedAt)).limit(50);

    // Extract timeExitHours + SL/TP from strategy parameters
    let timeExitHours = 96;
    let slPct = 2;
    let tpPct = 4;
    let sizingMode = "fixed";
    let sizingValue = 100;
    if (strat[0]?.parametersJson) {
      try {
        const params = JSON.parse(strat[0].parametersJson);
        timeExitHours = params.timeExitHours ?? 96;
        slPct = params.sl ?? 2;
        tpPct = params.tp ?? 4;
      } catch {}
    }

    // Legge global sizing mode da risk_limits (è quello effettivamente usato)
    try {
      const riskRows = await db.select().from(riskLimits).limit(1);
      if (riskRows.length > 0) {
        sizingMode = riskRows[0].globalSizingMode || "fixed";
        sizingValue = riskRows[0].globalSizingValue ?? 100;
      }
    } catch {}

    enriched.push({
      ...t,
      strategyName: strat[0]?.name || "Sconosciuta",
      decisionPnl: dj[0]?.decision || null,
      pnlCurve: snapshots.reverse().map(s => ({ time: s.collectedAt, pnl: s.pnl })),
      timeExitHours,
      slPct,
      tpPct,
      sizingMode,
      sizingValue,
    });
  }

  // Ordinamento finale
  const dir = sortDir === "asc" ? 1 : -1;
  enriched.sort((a, b) => {
    switch (sortBy) {
      case "pnl": {
        const aPnl = (a.realizedPnl || 0) + (a.unrealizedPnl || 0);
        const bPnl = (b.realizedPnl || 0) + (b.unrealizedPnl || 0);
        return (aPnl - bPnl) * dir;
      }
      case "date": {
        const aDate = a.closedAt || a.openedAt || "";
        const bDate = b.closedAt || b.openedAt || "";
        return aDate.localeCompare(bDate) * dir;
      }
      case "asset":
        return a.asset.localeCompare(b.asset) * dir;
      default:
        return ((a.realizedPnl || 0) - (b.realizedPnl || 0)) * dir;
    }
  });

  return NextResponse.json(enriched);
}