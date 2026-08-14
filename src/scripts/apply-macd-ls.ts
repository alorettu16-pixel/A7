import db, { strategies } from "@/db";
import { eq, sql } from "drizzle-orm";

const STRATEGIES_TO_KEEP = [
  "MACD 12/26/9 LONG+SHORT",
  "MACD 8/20/7 LONG+SHORT",
  "MACD 10/24/8 LONG+SHORT",
];

async function main() {
  // 1. Trova le strategie da mantenere e quelle da disattivare
  const all = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();

  for (const s of all) {
    if (STRATEGIES_TO_KEEP.includes(s.name)) {
      console.log(`✅ Mantengo: ${s.name}`);
    } else {
      db.update(strategies).set({ status: "watch" as const }).where(eq(strategies.id, s.id)).run();
      console.log(`⏸ Disattivo: ${s.name}`);
    }
  }

  // 2. Pulisci vecchi backtest e paper trades per ripartire puliti
  const keptIds = all.filter(s => STRATEGIES_TO_KEEP.includes(s.name)).map(s => s.id);
  const removedIds = all.filter(s => !STRATEGIES_TO_KEEP.includes(s.name)).map(s => s.id);

  // Chiudi paper trades aperti delle strategie rimosse
  for (const sid of removedIds) {
    db.run(sql`UPDATE paper_trades SET status = 'closed', closed_at = datetime('now') WHERE strategy_id = ${sid} AND status = 'open'`);
    console.log(`   Paper trades chiusi per strategy ${sid}`);
  }

  console.log(`\n✅ Strategie attive: ${keptIds.length}`);
  console.log(`   ${STRATEGIES_TO_KEEP.join(", ")}`);
  console.log(`\nOra esegui: npm run signals:generate per testare`);
}

main().catch(console.error);