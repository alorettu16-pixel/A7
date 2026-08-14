import db from "../db";
import { strategies } from "../db/schema";
import { eq, like } from "drizzle-orm";

// Trova strategie micro-scalping per nome
const scalp = db.select().from(strategies).where(
  like(strategies.name, "MICRO%")
).all();
const scalp2 = db.select().from(strategies).where(
  like(strategies.name, "SCALP%")
).all();
const macro = db.select().from(strategies).where(
  eq(strategies.name, "MACD 8/20/7 SL3 TP7")
).all();
const macro2 = db.select().from(strategies).where(
  eq(strategies.name, "MACD 12/26/9 SL4 TP8")
).all();
const macro3 = db.select().from(strategies).where(
  eq(strategies.name, "RSI14/50+EMA20 SL4 TP8")
).all();

const toActivate = [...scalp, ...scalp2, ...macro, ...macro2, ...macro3];
console.log(`Strategie da attivare: ${toActivate.length}`);

for (const s of toActivate) {
  db.update(strategies)
    .set({ status: "paper_active" })
    .where(eq(strategies.id, s.id))
    .run();
  console.log(` ✅ #${s.id} ${s.name}`);
}

const total = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
console.log(`\n📊 Totale paper_active: ${total.length}`);