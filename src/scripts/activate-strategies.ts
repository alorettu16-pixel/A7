import db from "../db";
import { strategies } from "../db/schema";
import { eq, like } from "drizzle-orm";

// Attiva tutte le strategie SCALP come paper_active
const scalp = db.select().from(strategies).where(eq(strategies.category, "custom")).all();
const scalpStrats = scalp.filter((s: any) => s.name.includes("SCALP"));

console.log(`Trovate ${scalpStrats.length} strategie SCALP`);

for (const s of scalpStrats) {
  // Attiva questa strategia come paper_active
  db.update(strategies)
    .set({ status: "paper_active" })
    .where(eq(strategies.id, s.id))
    .run();
  console.log(` ✅ #${s.id} ${s.name} → paper_active`);
}

// Attiva anche le migliori strategie MACD/RSI/EMA
const bestStrats = db.select().from(strategies).where(eq(strategies.status, "research")).all();
const toActivate = bestStrats.filter((s: any) => {
  const name = s.name;
  // Prendi quelle con SL/TP bilanciati
  return (
    name.includes("MACD 12/26/9") ||
    name.includes("MACD 8/20/7") ||
    name.includes("RSI14/55+EMA20") ||
    name.includes("RSI14/50+EMA20") ||
    name.includes("RSI14/55+EMA30") ||
    name.includes("EMA Crossover 20/50") ||
    name.includes("EMA Crossover 12/30") ||
    name.includes("RSI Oversold 14/35") ||
    name.includes("Bollinger 20/2 SL3") ||
    name.includes("EMA/20+MACD12/26/9")
  );
});

for (const s of toActivate) {
  if (s.name.includes("SCALP")) continue; // già attivate sopra
  db.update(strategies)
    .set({ status: "paper_active" })
    .where(eq(strategies.id, s.id))
    .run();
  console.log(` ✅ #${s.id} ${s.name} → paper_active`);
}

const total = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
console.log(`\n📊 Totale paper_active: ${total.length}`);