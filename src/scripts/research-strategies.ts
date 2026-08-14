import { researchWebStrategies } from "@/strategies/research";

async function main() {
  console.log("🔍 Ricerca strategie in corso...");
  const count = await researchWebStrategies();
  console.log(`✅ ${count} strategie caricate nel database.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});