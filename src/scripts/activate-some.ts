import db from "../db";
import { strategies } from "../db/schema";
import { eq } from "drizzle-orm";

const names = [
  "EMA 9/21 + RSI Filtro 50",
  "MACD Histogram 12/26/9",
  "Bollinger Bands Bounce 20/2",
  "RSI Extreme 14/25/75",
  "MACD Volume Breakout",
];

for (const name of names) {
  const s = db.select().from(strategies).where(eq(strategies.name, name)).get();
  if (s) {
    db.update(strategies)
      .set({ status: "paper_active" as any, statusReason: "Forzata a paper_active per demo" })
      .where(eq(strategies.id, s.id)).run();
    console.log("✅", name, "→ paper_active");
  } else {
    console.log("⚠", name, "non trovata");
  }
}

console.log("\nOra esegui: npm run signals:generate");