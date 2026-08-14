import db, { strategies } from "@/db";
import { eq } from "drizzle-orm";

// ─── MACD variants da testare (parametri già noti) ──────────────────────────
const MACD_VARIANTS = [
  { fast: 12, slow: 26, signal: 9, name: "MACD 12/26/9", sl: 4, tp: 8 },
  { fast: 8, slow: 20, signal: 7, name: "MACD 8/20/7", sl: 3, tp: 7 },
  { fast: 10, slow: 24, signal: 8, name: "MACD 10/24/8", sl: 4, tp: 8 },
  { fast: 14, slow: 28, signal: 10, name: "MACD 14/28/10", sl: 4, tp: 8 },
  { fast: 16, slow: 32, signal: 10, name: "MACD 16/32/10", sl: 4, tp: 8 },
];

async function main() {
  console.log("🔁 Disattivo tutte le strategie paper_active esistenti...");
  const existing = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
  for (const s of existing) {
    db.update(strategies).set({ status: "watch" as const }).where(eq(strategies.id, s.id)).run();
    console.log(`   ${s.name} → watch`);
  }

  console.log("\n📦 Creazione nuove strategie MACD LONG+SHORT...\n");

  const LONG_SHORT_DESC = "MACD crossover bidirezionale: crosses_above per LONG, crosses_below (invertito automaticamente) per SHORT. SL e TP simmetrici. Opera su qualsiasi condizione di mercato perché cattura entrambe le direzioni.";

  for (const v of MACD_VARIANTS) {
    const entryRules = [
      {
        indicator: "macd",
        params: { fast: v.fast, slow: v.slow, signal: v.signal },
        condition: "crosses_above",
        target: 0,
      },
    ];

    const exitRules = [
      { type: "sl", params: { pct: v.sl } },
      { type: "tp", params: { pct: v.tp } },
      { type: "time", params: { bars: 24 } }, // 96h = 4 giorni su 4h
    ];

    const parameters = {
      fast: v.fast, slow: v.slow, signal: v.signal,
      sl: v.sl, tp: v.tp, timeExitHours: 96,
    };

    db.insert(strategies).values({
      name: v.name + " LONG+SHORT",
      source: "web_research",
      category: "momentum",
      sourceDescription: LONG_SHORT_DESC,
      entryRulesJson: JSON.stringify(entryRules),
      exitRulesJson: JSON.stringify(exitRules),
      parametersJson: JSON.stringify(parameters),
      status: "paper_active",
      isDemo: true,
    }).run();

    console.log(`✅ ${v.name} LONG+SHORT — SL ${v.sl}% TP ${v.tp}%`);
  }

  console.log("\n✅ Strategie LONG+SHORT create. Ora esegui: npm run backtest:run");
}

main().catch(console.error);