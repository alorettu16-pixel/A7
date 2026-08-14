import db, { riskLimits } from "@/db";
import { eq } from "drizzle-orm";

export interface RiskLimitsState {
  liveTradingEnabled: boolean;
  maxDailyDrawdownPct: number;
  maxPositionSizeUsd: number;
  maxTotalExposureUsd: number;
  maxLeverageAllowed: number;
  allowedStrategies: number[];
  allowedBrokers: string[];
  killSwitchActive: boolean;
}

export async function getRiskLimits(): Promise<RiskLimitsState> {
  const limits = await db.select().from(riskLimits).limit(1);
  if (limits.length === 0) {
    // Create default row
    await db.insert(riskLimits).values({});
    return {
      liveTradingEnabled: false,
      maxDailyDrawdownPct: 10,
      maxPositionSizeUsd: 100,
      maxTotalExposureUsd: 500,
      maxLeverageAllowed: 1,
      allowedStrategies: [],
      allowedBrokers: [],
      killSwitchActive: false,
    };
  }

  const l = limits[0];
  return {
    liveTradingEnabled: l.liveTradingEnabled,
    maxDailyDrawdownPct: l.maxDailyDrawdownPct,
    maxPositionSizeUsd: l.maxPositionSizeUsd,
    maxTotalExposureUsd: l.maxTotalExposureUsd,
    maxLeverageAllowed: l.maxLeverageAllowed,
    allowedStrategies: JSON.parse(l.allowedStrategiesJson || "[]"),
    allowedBrokers: JSON.parse(l.allowedBrokersJson || "[]"),
    killSwitchActive: l.killSwitchActive,
  };
}

// WARNING: This function is called ONLY by the operator/scripts, never by automatic rule engine
export async function updateRiskLimitsManual(updates: Partial<RiskLimitsState>): Promise<void> {
  const existing = await db.select().from(riskLimits).limit(1);
  if (existing.length === 0) {
    await db.insert(riskLimits).values({
      ...(updates.liveTradingEnabled !== undefined ? { liveTradingEnabled: updates.liveTradingEnabled } : {}),
      ...(updates.maxDailyDrawdownPct !== undefined ? { maxDailyDrawdownPct: updates.maxDailyDrawdownPct } : {}),
      ...(updates.maxPositionSizeUsd !== undefined ? { maxPositionSizeUsd: updates.maxPositionSizeUsd } : {}),
      ...(updates.maxTotalExposureUsd !== undefined ? { maxTotalExposureUsd: updates.maxTotalExposureUsd } : {}),
      ...(updates.maxLeverageAllowed !== undefined ? { maxLeverageAllowed: updates.maxLeverageAllowed } : {}),
      ...(updates.allowedStrategies !== undefined ? { allowedStrategiesJson: JSON.stringify(updates.allowedStrategies) } : {}),
      ...(updates.allowedBrokers !== undefined ? { allowedBrokersJson: JSON.stringify(updates.allowedBrokers) } : {}),
      ...(updates.killSwitchActive !== undefined ? { killSwitchActive: updates.killSwitchActive } : {}),
      lastModifiedBy: "manual",
    });
    return;
  }

  const updateData: Record<string, unknown> = { lastModifiedBy: "manual" };
  if (updates.liveTradingEnabled !== undefined) updateData.liveTradingEnabled = updates.liveTradingEnabled;
  if (updates.maxDailyDrawdownPct !== undefined) updateData.maxDailyDrawdownPct = updates.maxDailyDrawdownPct;
  if (updates.maxPositionSizeUsd !== undefined) updateData.maxPositionSizeUsd = updates.maxPositionSizeUsd;
  if (updates.maxTotalExposureUsd !== undefined) updateData.maxTotalExposureUsd = updates.maxTotalExposureUsd;
  if (updates.maxLeverageAllowed !== undefined) updateData.maxLeverageAllowed = updates.maxLeverageAllowed;
  if (updates.allowedStrategies !== undefined) updateData.allowedStrategiesJson = JSON.stringify(updates.allowedStrategies);
  if (updates.allowedBrokers !== undefined) updateData.allowedBrokersJson = JSON.stringify(updates.allowedBrokers);
  if (updates.killSwitchActive !== undefined) updateData.killSwitchActive = updates.killSwitchActive;

  await db
    .update(riskLimits)
    .set(updateData)
    .where(eq(riskLimits.id, existing[0].id));
}

// Kill switch — automatic safety measure, not a rule change
export async function activateKillSwitch(reason: string): Promise<void> {
  const existing = await db.select().from(riskLimits).limit(1);
  if (existing.length > 0) {
    await db
      .update(riskLimits)
      .set({ killSwitchActive: true, lastModifiedBy: "manual" })
      .where(eq(riskLimits.id, existing[0].id));
  }
  console.warn(`[KILL SWITCH] Attivato: ${reason}`);
}

export async function deactivateKillSwitch(): Promise<void> {
  const existing = await db.select().from(riskLimits).limit(1);
  if (existing.length > 0) {
    await db
      .update(riskLimits)
      .set({ killSwitchActive: false, lastModifiedBy: "manual" })
      .where(eq(riskLimits.id, existing[0].id));
  }
}