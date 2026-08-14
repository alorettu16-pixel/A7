import db from "../db";
import { strategies } from "../db/schema";
import { eq } from "drizzle-orm";

const all = db.select().from(strategies).all();
console.log("Strategie trovate:", all.length);
for (const s of all) {
  console.log(`  - #${s.id} ${s.name} [${s.status}]`);
  db.update(strategies).set({ status: "research" as any, statusReason: null }).where(eq(strategies.id, s.id)).run();
}
console.log("\nReset completato. Tutte le strategie sono ora 'research'.");