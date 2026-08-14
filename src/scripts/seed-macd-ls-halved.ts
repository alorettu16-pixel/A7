import db, { strategies } from "@/db";
import { eq } from "drizzle-orm";

const MACD_VARIANTS = [
  { fast: 12, slow: 26, signal: 9, name: "MACD 12/26/9", sl: 2, tp: 4 },
  { fast: 8, slow: 20, signal: 7, name: "MACD 8/20/7", sl: 1.5, tp: 3.5 },
  { fast: 10, slow: 24, signal: 8, name: "MACD 10/24/8", sl: 2, tp: 4 },
  { fast: 14, slow: 28, signal: 10, name: "MACD 14/28/10", sl: 2, tp: 4 },
  { fast: 16, slow: 32, signal: 10, name: "MACD 16/32/10", sl: 2, tp: 4 },
];

async function main() {
  console.log("📦 Creazione nuove strategie MACD LONG+SHORT con SL/TP DIMEZZATI...\n");

  const LONG_SHORT_DESC = "MACD crossover bidirezionale. SL e TP dimezzati rispetto alle strategie standard per ridurre il rischio e chiudere piu' rapidamente. Tempo exit ridotto a 12 barre (2 giorni su 4h).";

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
      { type: "time", params: { bars: 12 } }, // 48h = 2 giorni su 4h
    ];

    const parameters = {
      fast: v.fast, slow: v.slow, signal: v.signal,
      sl: v.sl, tp: v.tp, timeExitHours: 48,
    };

    db.insert(strategies).values({
      name: v.name + " LONG+SHORT SL/TP-x0.5",
      source: "web_research",
      category: "momentum",
      sourceDescription: LONG_SHORT_DESC,
      entryRulesJson: JSON.stringify(entryRules),
      exitRulesJson: JSON.stringify(exitRules),
      parametersJson: JSON.stringify(parameters),
      status: "paper_active",
      isDemo: true,
    }).run();

    console.log(`✅ ${v.name} LONG+SHORT SL/TP-x0.5 — SL ${v.sl}% TP ${v.tp}% (halved)`);
  }

  console.log("\n✅ 5 nuove strategie con SL/TP dimezzati create.");
  console.log("Ora esegui: npm run signals:generate per testare");
}

main().catch(console.error);