import db, { strategyVersions, strategies, ruleChanges, ruleSets } from "@/db";
import { eq, desc, and } from "drizzle-orm";

export interface ParamChange {
  strategyId: number;
  paramName: string;
  oldValue: number;
  newValue: number;
  reason: string;
  evidenceSummary: string;
}

export async function updateParameters(
  strategyId: number,
  changes: ParamChange[]
): Promise<void> {
  // Get current strategy
  const strategy = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, strategyId))
    .limit(1);

  if (strategy.length === 0) return;

  const currentParams = JSON.parse(strategy[0].parametersJson || "{}");
  const beforeJson = JSON.stringify(currentParams);

  // Apply changes
  for (const change of changes) {
    currentParams[change.paramName] = change.newValue;
  }
  const afterJson = JSON.stringify(currentParams);

  // Get current version
  const latestVersion = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.strategyId, strategyId))
    .orderBy(desc(strategyVersions.version))
    .limit(1);

  const version = latestVersion.length > 0 ? latestVersion[0].version + 1 : 1;

  // Save version
  await db.insert(strategyVersions).values({
    strategyId,
    version,
    parametersJson: afterJson,
    reason: changes.map(c => c.reason).join("; "),
    evidenceSummary: changes.map(c => c.evidenceSummary).join("; "),
    beforeJson,
    afterJson,
  });

  // Update strategy params
  await db
    .update(strategies)
    .set({ parametersJson: afterJson })
    .where(eq(strategies.id, strategyId));

  // Record rule change
  const latestRuleSet = await db
    .select()
    .from(ruleSets)
    .where(and(eq(ruleSets.strategyId, strategyId), eq(ruleSets.active, true)))
    .limit(1);

  // Create new rule set
  const newRuleSet = await db.insert(ruleSets).values({
    strategyId,
    version,
    active: true,
    rulesJson: afterJson,
  });

  // Deactivate old rule set
  if (latestRuleSet.length > 0) {
    await db
      .update(ruleSets)
      .set({ active: false })
      .where(eq(ruleSets.id, latestRuleSet[0].id));

    await db.insert(ruleChanges).values({
      strategyId,
      oldRuleSetId: latestRuleSet[0].id,
      newRuleSetId: Number(newRuleSet.lastInsertRowid),
      changedBy: "hermes",
      reason: changes.map(c => c.reason).join("; "),
      evidenceSummary: changes.map(c => c.evidenceSummary).join("; "),
      beforeJson,
      afterJson,
    });
  }
}