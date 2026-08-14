import { researchWebStrategies, BUILT_IN_STRATEGIES, saveResearchStrategy } from "@/strategies/research";
import db, { strategies, riskLimits } from "@/db";

async function main() {
  console.log("🌱 Seeding A7 database...\n");

  // 1. Seed risk limits (default: live_trading_enabled = false)
  const existingLimits = await db.select().from(riskLimits).limit(1);
  if (existingLimits.length === 0) {
    await db.insert(riskLimits).values({});
    console.log("✅ Risk limits create (live trading disabilitato)");
  } else {
    console.log("⏭ Risk limits già esistenti");
  }

  // 2. Seed built-in strategies
  let count = 0;
  for (const s of BUILT_IN_STRATEGIES) {
    const id = await saveResearchStrategy(s);
    if (id) count++;
  }
  console.log(`✅ ${count} strategie caricate`);

  // 3. Summary
  const allStrat = await db.select().from(strategies);
  console.log(`\n📊 Totale strategie nel database: ${allStrat.length}`);
  for (const s of allStrat) {
    console.log(`   - ${s.name} (${s.status}) [${s.category}]`);
  }

  console.log("\n✅ Seed completato.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});