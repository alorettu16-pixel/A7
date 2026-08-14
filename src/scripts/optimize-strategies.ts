import db from "../db";
import { strategies } from "../db/schema";
import { eq } from "drizzle-orm";

// Disattiva tutte le paper_active
db.update(strategies)
  .set({ status: "watch" })
  .where(eq(strategies.status, "paper_active"))
  .run();

console.log("✅ Tutte le strategie disattivate → watch");

// Riattiva solo le migliori
const KEEP: string[] = [
  "MACD 8/20/7 SL3 TP7",
  "MACD 12/26/9 SL4 TP8",
  "RSI14/50+EMA20 SL4 TP8",
  "SCALP UT Bot ATR/ EMA SL1.5 TP3",   // versione con KV=2.5 (la #329)
  "SCALP MACD8/20/7 PSAR EMA SL1.5 TP3",
  "SCALP MACD12/26/9 PSAR EMA SL1.5 TP3",
  "SCALP UT Bot ATR/ EMA SL2 TP4",     // versione con KV=2
];

for (const name of KEEP) {
  const found = db.select().from(strategies).where(eq(strategies.name, name)).all();
  if (found.length === 0) {
    console.log(` ❌ Non trovata: "${name}"`);
    continue;
  }
  for (const s of found) {
    db.update(strategies)
      .set({ status: "paper_active" })
      .where(eq(strategies.id, s.id))
      .run();
    console.log(` ✅ #${s.id} ${s.name} → paper_active`);
  }
}

// Aggiorna SL/TP delle SCALP UT Bot e MACD+PSAR
db.update(strategies)
  .set({
    exitRulesJson: JSON.stringify([
      { type: "sl", params: { pct: 2.0 } },
      { type: "tp", params: { pct: 4.0 } },
      { type: "time", params: { bars: 48 } },
    ]),
    parametersJson: JSON.stringify({ slPct: 2.0, tpPct: 4.0, timeExitBars: 48 }),
  })
  .where(eq(strategies.name, "SCALP UT Bot ATR/ EMA SL1.5 TP3"))
  .run();
console.log(" ✅ SCALP UT Bot SL1.5/TP3 → SL2/TP4");

db.update(strategies)
  .set({
    exitRulesJson: JSON.stringify([
      { type: "sl", params: { pct: 2.0 } },
      { type: "tp", params: { pct: 4.0 } },
      { type: "time", params: { bars: 96 } },
    ]),
    parametersJson: JSON.stringify({ slPct: 2.0, tpPct: 4.0, timeExitBars: 96 }),
  })
  .where(eq(strategies.name, "SCALP MACD8/20/7 PSAR EMA SL1.5 TP3"))
  .run();
console.log(" ✅ SCALP MACD8/20/7 SL1.5/TP3 → SL2/TP4");

db.update(strategies)
  .set({
    exitRulesJson: JSON.stringify([
      { type: "sl", params: { pct: 2.0 } },
      { type: "tp", params: { pct: 4.0 } },
      { type: "time", params: { bars: 96 } },
    ]),
    parametersJson: JSON.stringify({ slPct: 2.0, tpPct: 4.0, timeExitBars: 96 }),
  })
  .where(eq(strategies.name, "SCALP MACD12/26/9 PSAR EMA SL1.5 TP3"))
  .run();
console.log(" ✅ SCALP MACD12/26/9 SL1.5/TP3 → SL2/TP4");

const total = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
console.log(`\n📊 Totale paper_active: ${total.length}`);
for (const s of total) console.log(`   #${s.id} ${s.name}`);