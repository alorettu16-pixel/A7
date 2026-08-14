import db, { riskLimits } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const limits = await db.select().from(riskLimits).limit(1);
  if (limits.length === 0) {
    return NextResponse.json({
      id: null, liveTradingEnabled: false, maxDailyDrawdownPct: 10, maxPositionSizeUsd: 100,
      maxTotalExposureUsd: 500, maxLeverageAllowed: 1, demoBudgetUsd: 10000,
      allowedStrategies: [], allowedBrokers: [], killSwitchActive: false,
    });
  }
  const l = limits[0];
  return NextResponse.json({
    id: l.id, liveTradingEnabled: l.liveTradingEnabled,
    maxDailyDrawdownPct: l.maxDailyDrawdownPct,
    maxPositionSizeUsd: l.maxPositionSizeUsd,
    maxTotalExposureUsd: l.maxTotalExposureUsd,
    maxLeverageAllowed: l.maxLeverageAllowed,
    demoBudgetUsd: l.demoBudgetUsd,
    allowedStrategies: JSON.parse(l.allowedStrategiesJson || "[]"),
    allowedBrokers: JSON.parse(l.allowedBrokersJson || "[]"),
    killSwitchActive: l.killSwitchActive,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const limits = await db.select().from(riskLimits).limit(1);

  if (limits.length === 0) {
    return NextResponse.json({ ok: false, error: "Nessun risk limits trovato" });
  }

  const l = limits[0];
  await db.update(riskLimits).set({
    maxDailyDrawdownPct: body.maxDailyDrawdownPct ?? l.maxDailyDrawdownPct,
    maxPositionSizeUsd: body.maxPositionSizeUsd ?? l.maxPositionSizeUsd,
    maxTotalExposureUsd: body.maxTotalExposureUsd ?? l.maxTotalExposureUsd,
    maxLeverageAllowed: body.maxLeverageAllowed ?? l.maxLeverageAllowed,
    demoBudgetUsd: body.demoBudgetUsd ?? l.demoBudgetUsd,
  }).where(eq(riskLimits.id, l.id)).run();

  return NextResponse.json({ ok: true });
}