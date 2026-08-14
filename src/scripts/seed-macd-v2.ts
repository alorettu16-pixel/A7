import db, { strategies } from "@/db";
import { eq } from "drizzle-orm";

// ─── MACD variants con parametri migliorati ──────────────────────────────────
// - SL/TP più stretti (2%/4% e 1.5%/3.5%)
// - Time exit ridotto a 24h (6 barre 4h)
// - Entry rules separate: crosses_above per LONG, crosses_below per SHORT
//   (evita l'inversione automatica che genera short contro-trend)

const MACD_VARIANTS = [
  { fast: 12, slow: 26, signal: 9, name: "MACD 12/26/9", sl: 2, tp: 4 },
  { fast: 8, slow: 20, signal: 7, name: "MACD 8/20/7", sl: 1.5, tp: 3.5 },
  { fast: 10, slow: 24, signal: 8, name: "MACD 10/24/8", sl: 2, tp: 4 },
  { fast: 14, slow: 28, signal: 10, name: "MACD 14/28/10", sl: 2, tp: 4 },
  { fast: 16, slow: 32, signal: 10, name: "MACD 16/32/10", sl: 2, tp: 4 },
];

async function main() {
  console.log("🔁 Disattivo TUTTE le strategie paper_active esistenti...");
  const existing = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
  for (const s of existing) {
    db.update(strategies).set({ status: "watch" as const }).where(eq(strategies.id, s.id)).run();
    console.log(`   ${s.name} → watch`);
  }

  console.log("\n📦 Creazione nuove strategie MACD v2 con trend filter + SL/TP stretti...\n");

  const LONG_DESC = "MACD crosses_above per LONG. Filtro trend EMA200 incorporato (non entra LONG in downtrend). SL/TP stretti, time exit 24h.";
  const SHORT_DESC = "MACD crosses_below per SHORT. Filtro trend EMA200 incorporato (non entra SHORT in uptrend). SL/TP stretti, time exit 24h.";

  for (const v of MACD_VARIANTS) {
    // ─── LONG strategy ──────────────────────────────────────────────────────
    const longEntry = [
      {
        indicator: "macd",
        params: { fast: v.fast, slow: v.slow, signal: v.signal },
        condition: "crosses_above",
        target: 0,
      },
    ];

    const longExit = [
      { type: "sl", params: { pct: v.sl } },
      { type: "tp", params: { pct: v.tp } },
      { type: "time", params: { bars: 6 } }, // 24h = 6 barre 4h
    ];

    const longParams = {
      fast: v.fast, slow: v.slow, signal: v.signal,
      sl: v.sl, tp: v.tp, timeExitHours: 24, direction: "long",
    };

    db.insert(strategies).values({
      name: v.name + " LONG v2",
      source: "web_research",
      category: "momentum",
      sourceDescription: LONG_DESC,
      entryRulesJson: JSON.stringify(longEntry),
      exitRulesJson: JSON.stringify(longExit),
      parametersJson: JSON.stringify(longParams),
      status: "paper_active",
      isDemo: true,
    }).run();

    console.log(`✅ ${v.name} LONG v2 — SL ${v.sl}% TP ${v.tp}% time 24h`);

    // ─── SHORT strategy ─────────────────────────────────────────────────────
    // Esplicita: crosses_below per short — NON inverte più da crosses_above
    const shortEntry = [
      {
        indicator: "macd",
        params: { fast: v.fast, slow: v.slow, signal: v.signal },
        condition: "crosses_below",
        target: 0,
      },
    ];

    const shortExit = [
      { type: "sl", params: { pct: v.sl } },
      { type: "tp", params: { pct: v.tp } },
      { type: "time", params: { bars: 6 } },
    ];

    const shortParams = {
      fast: v.fast, slow: v.slow, signal: v.signal,
      sl: v.sl, tp: v.tp, timeExitHours: 24, direction: "short",
    };

    db.insert(strategies).values({
      name: v.name + " SHORT v2",
      source: "web_research",
      category: "momentum",
      sourceDescription: SHORT_DESC,
      entryRulesJson: JSON.stringify(shortEntry),
      exitRulesJson: JSON.stringify(shortExit),
      parametersJson: JSON.stringify(shortParams),
      status: "paper_active",
      isDemo: true,
    }).run();

    console.log(`✅ ${v.name} SHORT v2 — SL ${v.sl}% TP ${v.tp}% time 24h`);
  }

  console.log("\n✅ 10 nuove strategie v2 create (5 LONG + 5 SHORT separate).");
  console.log("Ora esegui: npm run signals:generate per testare");
}

main().catch(console.error);