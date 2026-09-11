// Seed RSI36 Oversold LONG su 4h per SOL, ETH, DOGE — solo INSERT, non distruttivo
import db, { strategies } from "@/db";

// RSI 36 Oversold: crossunder RSI(14) sotto 36 → LONG
const RSI_VARIANTS = [
  { asset: "SOL",  sl: 2.0, tp: 4.0, timeExit: 24 },
  { asset: "ETH",  sl: 2.0, tp: 4.0, timeExit: 24 },
  { asset: "DOGE", sl: 2.0, tp: 4.0, timeExit: 24 },
];

function buildName(asset: string, sl: number, tp: number): string {
  return `RSI36 Oversold ${asset} 4h SL${sl} TP${tp}`;
}

const entryRule = {
  indicator: "rsi",
  params: { period: 14 },
  condition: "crosses_below",
  target: 36,
};

console.log(`\nAggiungo ${RSI_VARIANTS.length} strategie RSI36 Oversold...\n`);

for (const v of RSI_VARIANTS) {
  const name = buildName(v.asset, v.sl, v.tp);

  // Controlla se esiste già
  const existing = db.select().from(strategies)
    .where((s: any) => `name = '${name}'`)
    .all() as any[];
  if (existing.length > 0) {
    console.log(`  ⏩ ${name}: già presente (id ${existing[0].id}), skip`);
    continue;
  }

  const entryRules = [
    {
      indicator: "rsi",
      params: { period: 14 },
      condition: "crosses_below",
      target: 36,
    },
  ];

  const exitRules = [
    { type: "sl", params: { pct: v.sl } },
    { type: "tp", params: { pct: v.tp } },
    { type: "time", params: { hours: v.timeExit } },
  ];

  const parameters = {
    rsiPeriod: 14,
    oversoldThreshold: 36,
    sl: v.sl,
    tp: v.tp,
    timeExitHours: v.timeExit,
    direction: "long",
    sizing_mode: "fixed",
    sizing_value: 50,
  };

  db.insert(strategies).values({
    name,
    source: "traderdev_backtest",
    category: "mean_reversion",
    sourceDescription:
      `RSI(14) crossunder 36 → LONG su ${v.asset} 4h. Backtest Jun-Sep 2026: SOL +21.7% Sharpe 2.9, ETH +1.2%, DOGE +0.4%. SL2/TP4, timeExit 24h.`,
    entryRulesJson: JSON.stringify(entryRules),
    exitRulesJson: JSON.stringify(exitRules),
    parametersJson: JSON.stringify(parameters),
    status: "paper_active",
    isDemo: true,
  }).run();

  console.log(`  ✅ ${name} — paper_active`);
}

console.log(`\n✅ Seed completato.`);

// Mostra il totale
const total = db.select().from(strategies).all() as any[];
const active = total.filter((s: any) => s.status === "paper_active");
console.log(`\nStrategie totali: ${total.length}`);
console.log(`Strategie paper_active: ${active.length}`);
for (const s of active) {
  console.log(`  - ${s.name}`);
}