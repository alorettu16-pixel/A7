import { reviewOutcomes } from "@/review/outcomes";

async function main() {
  console.log("📋 Revisione esiti...");
  const results = await reviewOutcomes();
  console.log(`✅ Revisionati ${results.length} trade conclusi`);
  for (const r of results) {
    console.log(`   Trade #${r.tradeId}: ${r.finalOutcome}, PnL: ${r.simulatedPnl}$, Decisione: ${r.wasDecisionGood ? "✅" : "❌"}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});