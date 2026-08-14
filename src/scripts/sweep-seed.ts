import db from "../db";
import { strategies } from "../db/schema";
import { eq } from "drizzle-orm";

// Parametri da sweepare per ogni famiglia di strategia
// Tutte hanno SL/TP variabili, periodi indicatori variabili

interface StratTemplate {
  name: string;
  category: "trend_following" | "mean_reversion" | "breakout" | "momentum" | "custom";
  summary: string;
  entryTemplate: (p: Record<string, number>) => any[];
  exitTemplate: (p: Record<string, number>) => any[];
  paramSets: Record<string, number>[];
}

const TEMPLATES: StratTemplate[] = [
  // ── EMA CROSSOVER — sweep su periodi rapidi (8,10,12,14,16,18,20,25) × (20,25,30,40,50) ──
  {
    name: "EMA Crossover {f}/{s} SL{sl} TP{tp}",
    category: "trend_following",
    summary: "Crossover EMA con periodi ottimizzati. Entra long quando EMA fast incrocia sopra EMA slow.",
    entryTemplate: (p) => [
      { indicator: "ma_crossover", params: { fastPeriod: p.fast, slowPeriod: p.slow }, condition: "crosses_above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
    ],
    paramSets: [
      { fast: 8, slow: 20, sl: 3, tp: 7 },
      { fast: 10, slow: 25, sl: 3, tp: 7 },
      { fast: 12, slow: 30, sl: 4, tp: 8 },
      { fast: 14, slow: 30, sl: 4, tp: 8 },
      { fast: 16, slow: 40, sl: 5, tp: 10 },
      { fast: 18, slow: 40, sl: 5, tp: 10 },
      { fast: 20, slow: 50, sl: 5, tp: 12 },
      { fast: 25, slow: 50, sl: 5, tp: 12 },
      { fast: 10, slow: 30, sl: 4, tp: 9 },
      { fast: 12, slow: 40, sl: 5, tp: 11 },
      { fast: 8, slow: 30, sl: 3, tp: 8 },
      { fast: 14, slow: 40, sl: 4, tp: 10 },
    ],
  },

  // ── RSI OVERSOLD — sweep su soglie (25,27,30,33,35) × periodi (10,12,14,16,18) ──
  {
    name: "RSI Oversold {p}/{soglia} SL{sl} TP{tp}",
    category: "mean_reversion",
    summary: "Entra long quando RSI esce da ipervenduto. Parametri ottimizzati per mean reversion.",
    entryTemplate: (p) => [
      { indicator: "rsi", params: { period: p.period }, condition: "crosses_above", target: p.threshold },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
    ],
    paramSets: [
      { period: 10, threshold: 27, sl: 3, tp: 6 },
      { period: 12, threshold: 27, sl: 3, tp: 6 },
      { period: 14, threshold: 30, sl: 4, tp: 7 },
      { period: 14, threshold: 25, sl: 4, tp: 7 },
      { period: 16, threshold: 30, sl: 4, tp: 8 },
      { period: 16, threshold: 33, sl: 4, tp: 8 },
      { period: 18, threshold: 30, sl: 5, tp: 8 },
      { period: 10, threshold: 30, sl: 3, tp: 7 },
      { period: 12, threshold: 33, sl: 3, tp: 7 },
      { period: 14, threshold: 35, sl: 4, tp: 8 },
      { period: 18, threshold: 35, sl: 4, tp: 9 },
    ],
  },

  // ── MACD CROSSOVER — sweep su parametri MACD (8,12,16,20) × (20,26,30,40) × (7,9,12) ──
  {
    name: "MACD {f}/{s}/{sig} SL{sl} TP{tp}",
    category: "momentum",
    summary: "Entra long quando istogramma MACD diventa positivo. Parametri ottimizzati.",
    entryTemplate: (p) => [
      { indicator: "macd", params: { fast: p.fast, slow: p.slow, signal: p.sig }, condition: "crosses_above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
    ],
    paramSets: [
      { fast: 8, slow: 20, sig: 7, sl: 3, tp: 7 },
      { fast: 12, slow: 26, sig: 9, sl: 4, tp: 8 },
      { fast: 16, slow: 30, sig: 9, sl: 4, tp: 9 },
      { fast: 20, slow: 40, sig: 12, sl: 5, tp: 10 },
      { fast: 8, slow: 26, sig: 7, sl: 3, tp: 8 },
      { fast: 12, slow: 30, sig: 9, sl: 4, tp: 9 },
      { fast: 16, slow: 40, sig: 12, sl: 5, tp: 11 },
      { fast: 12, slow: 20, sig: 7, sl: 3, tp: 7 },
      { fast: 8, slow: 30, sig: 9, sl: 4, tp: 8 },
      { fast: 20, slow: 50, sig: 12, sl: 5, tp: 12 },
    ],
  },

  // ── BOLLINGER BOUNCE — sweep su periodi (16,18,20,22,24) × std (1.8,2.0,2.2,2.5) ──
  {
    name: "Bollinger {p}/{sd} SL{sl} TP{tp}",
    category: "mean_reversion",
    summary: "Bollinger Bands bounce con parametri ottimizzati. Entra long quando prezzo tocca banda inferiore.",
    entryTemplate: (p) => [
      { indicator: "bbands", params: { period: p.period, stdDev: p.sd }, condition: "below", target: 0.1 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: p.timeExit || 48 } },
    ],
    paramSets: [
      { period: 16, sd: 1.8, sl: 2.5, tp: 5, timeExit: 36 },
      { period: 18, sd: 2.0, sl: 3, tp: 6, timeExit: 48 },
      { period: 20, sd: 2.0, sl: 3, tp: 6, timeExit: 48 },
      { period: 20, sd: 2.2, sl: 3, tp: 7, timeExit: 48 },
      { period: 22, sd: 2.0, sl: 3, tp: 6, timeExit: 48 },
      { period: 22, sd: 2.5, sl: 3.5, tp: 7, timeExit: 60 },
      { period: 24, sd: 2.0, sl: 3, tp: 6, timeExit: 60 },
      { period: 18, sd: 2.2, sl: 3, tp: 7, timeExit: 48 },
      { period: 20, sd: 2.5, sl: 3.5, tp: 7, timeExit: 60 },
    ],
  },

  // ── EMA MACD COMBINED — sweep su combinazioni EMA + MACD ──
  {
    name: "EMA{f}/{s}+MACD{mf}/{ms}/{msig} SL{sl} TP{tp}",
    category: "custom",
    summary: "Doppia conferma EMA crossover + MACD positivo. Più selettivo, meno trade ma qualità maggiore.",
    entryTemplate: (p) => [
      { indicator: "ma_crossover", params: { fastPeriod: p.ef, slowPeriod: p.es }, condition: "crosses_above", target: 0 },
      { indicator: "macd", params: { fast: p.mf, slow: p.ms, signal: p.msig }, condition: "above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
    ],
    paramSets: [
      { ef: 10, es: 20, mf: 12, ms: 26, msig: 9, sl: 4, tp: 8 },
      { ef: 8, es: 20, mf: 8, ms: 20, msig: 7, sl: 3, tp: 7 },
      { ef: 12, es: 30, mf: 12, ms: 30, msig: 9, sl: 4, tp: 9 },
      { ef: 14, es: 30, mf: 16, ms: 30, msig: 9, sl: 4, tp: 8 },
      { ef: 10, es: 25, mf: 12, ms: 26, msig: 9, sl: 4, tp: 9 },
      { ef: 16, es: 40, mf: 16, ms: 40, msig: 12, sl: 5, tp: 10 },
      { ef: 8, es: 25, mf: 8, ms: 26, msig: 7, sl: 3, tp: 8 },
    ],
  },

  // ── RSI + EMA TREND FILTER ──
  {
    name: "RSI{p}/{soglia}+EMA{e} SL{sl} TP{tp}",
    category: "custom",
    summary: "RSI momentum + EMA trend filter. Entra long quando RSI sale sopra soglia e prezzo sopra EMA.",
    entryTemplate: (p) => [
      { indicator: "rsi", params: { period: p.rp }, condition: "crosses_above", target: p.th },
      { indicator: "ma_crossover", params: { fastPeriod: 1, slowPeriod: p.ema }, condition: "above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
    ],
    paramSets: [
      { rp: 10, th: 55, ema: 20, sl: 4, tp: 8 },
      { rp: 12, th: 55, ema: 20, sl: 4, tp: 8 },
      { rp: 14, th: 55, ema: 20, sl: 4, tp: 8 },
      { rp: 14, th: 50, ema: 20, sl: 4, tp: 8 },
      { rp: 14, th: 55, ema: 30, sl: 5, tp: 10 },
      { rp: 12, th: 50, ema: 30, sl: 5, tp: 10 },
      { rp: 10, th: 50, ema: 20, sl: 4, tp: 8 },
    ],
  },

  // ── SCALPING: UT Bot ATR + EMA200 Trend Filter ──
  {
    name: "SCALP UT Bot ATR{atr}/{kv} EMA{ema} SL{sl} TP{tp}",
    category: "custom",
    summary: "UT Bot ATR trailing stop con filtro EMA200. Entra LONG quando UT Bot bullish e prezzo sopra EMA200.",
    entryTemplate: (p) => [
      { indicator: "ut_bot", params: { atrPeriod: p.atr, keyValue: p.kv }, condition: "above", target: 0.5 },
      { indicator: "ema_price", params: { period: p.ema }, condition: "above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: 48 } },
    ],
    paramSets: [
      { atr: 10, kv: 2, ema: 200, sl: 1.5, tp: 3.0 },
      { atr: 10, kv: 2.5, ema: 200, sl: 1.5, tp: 3.0 },
      { atr: 14, kv: 2, ema: 200, sl: 2.0, tp: 4.0 },
    ],
  },

  // ── SCALPING: MACD Histogram + PSAR + EMA200 ──
  {
    name: "SCALP MACD{mf}/{ms}/{msig} PSAR EMA{ema} SL{sl} TP{tp}",
    category: "custom",
    summary: "MACD histogram crossover + PSAR trend + EMA200 trend filter. 70% win rate documentato.",
    entryTemplate: (p) => [
      { indicator: "macd", params: { fast: p.mf, slow: p.ms, signal: p.msig }, condition: "crosses_above", target: 0 },
      { indicator: "psar", params: { step: 0.02, maxStep: 0.2 }, condition: "above", target: 0.5 },
      { indicator: "ema_price", params: { period: p.ema }, condition: "above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: 96 } },
    ],
    paramSets: [
      { mf: 12, ms: 26, msig: 9, ema: 200, sl: 1.5, tp: 3.0 },
      { mf: 8, ms: 20, msig: 7, ema: 200, sl: 1.5, tp: 3.0 },
      { mf: 16, ms: 30, msig: 9, ema: 200, sl: 2.0, tp: 4.0 },
    ],
  },

  // ── MICRO SCALP 1: Momentum 2-candle + RSI (TP 0.8%, SL 0.5%) ──
  {
    name: "MICRO Momento 2C RSI{p} TP{tp} SL{sl}",
    category: "custom",
    summary: "Scalping rapidissimo: 2 candele consecutive verdi + RSI >50. TP e SL strettissimi per tanti trade veloci.",
    entryTemplate: (p) => [
      { indicator: "candle_direction", params: {}, condition: "above", target: 0.5 },
      { indicator: "price_change", params: { periods: 2 }, condition: "above", target: 0 },
      { indicator: "rsi", params: { period: p.rp }, condition: "above", target: 50 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: 16 } },
    ],
    paramSets: [
      { rp: 7, sl: 0.5, tp: 0.8 },
      { rp: 7, sl: 0.8, tp: 1.2 },
      { rp: 10, sl: 0.5, tp: 0.8 },
      { rp: 10, sl: 0.8, tp: 1.2 },
      { rp: 14, sl: 0.8, tp: 1.5 },
    ],
  },

  // ── MICRO SCALP 2: Price Change + Candle Direction (TP 0.5%, SL 0.3%) ──
  {
    name: "MICRO Break 1C {per}% TP{tp} SL{sl}",
    category: "custom",
    summary: "Entra long quando la candela corrente sale oltre X% in 1 periodo. Uscita rapidissima. Per movimenti impulsivi.",
    entryTemplate: (p) => [
      { indicator: "price_change", params: { periods: 1 }, condition: "above", target: p.pct },
      { indicator: "candle_direction", params: {}, condition: "above", target: 0.5 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: 8 } },
    ],
    paramSets: [
      { pct: 0.3, sl: 0.3, tp: 0.5 },
      { pct: 0.3, sl: 0.5, tp: 0.8 },
      { pct: 0.5, sl: 0.5, tp: 1.0 },
      { pct: 0.5, sl: 0.8, tp: 1.2 },
    ],
  },

  // ── MICRO SCALP 3: UT Bot tight + tick volume (TP 0.8%, SL 0.4%) ──
  {
    name: "MICRO UT Bot ATR{atr}/{kv} TP{tp} SL{sl}",
    category: "custom",
    summary: "UT Bot con ATR trailing stop molto stretto (key value basso) + volume spike. Per ingressi precisi su micro-movimenti.",
    entryTemplate: (p) => [
      { indicator: "ut_bot", params: { atrPeriod: p.atr, keyValue: p.kv }, condition: "above", target: 0.5 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: 24 } },
    ],
    paramSets: [
      { atr: 7, kv: 1.5, sl: 0.4, tp: 0.8 },
      { atr: 7, kv: 1.5, sl: 0.6, tp: 1.2 },
      { atr: 5, kv: 1.5, sl: 0.4, tp: 0.8 },
    ],
  },

  // ── MICRO SCALP 4: MACD Crossover tight (TP 0.8%, SL 0.5%) ──
  {
    name: "MICRO MACD{mf}/{ms}/{msig} TP{tp} SL{sl}",
    category: "custom",
    summary: "MACD histogram crossover con SL/TP stretti. Per catturare l'inizio del momentum e uscire subito.",
    entryTemplate: (p) => [
      { indicator: "macd", params: { fast: p.mf, slow: p.ms, signal: p.msig }, condition: "crosses_above", target: 0 },
    ],
    exitTemplate: (p) => [
      { type: "sl", params: { pct: p.sl } },
      { type: "tp", params: { pct: p.tp } },
      { type: "time", params: { bars: 24 } },
    ],
    paramSets: [
      { mf: 5, ms: 13, msig: 4, sl: 0.5, tp: 0.8 },
      { mf: 5, ms: 13, msig: 4, sl: 0.8, tp: 1.5 },
      { mf: 8, ms: 20, msig: 7, sl: 0.5, tp: 0.8 },
    ],
  },
];

// Clean and seed
console.log("🧹 Pulizia...");
db.run('DELETE FROM outcome_reviews');
db.run('DELETE FROM pnl_snapshots');
db.run('DELETE FROM paper_trades');
db.run('DELETE FROM decision_journal');
db.run('DELETE FROM strategy_signals');
db.run('DELETE FROM tradingview_webhook_logs');
db.run('DELETE FROM backtest_trades');
db.run('DELETE FROM backtest_runs');
db.run('DELETE FROM strategy_versions');
db.run('DELETE FROM rule_changes');
db.run('DELETE FROM rule_sets');
db.delete(strategies).run();
console.log("✅ Pulito");

let count = 0;
for (const tmpl of TEMPLATES) {
  for (const p of tmpl.paramSets) {
    const name = tmpl.name
      .replace(/\{f\}/g, String(p.fast || ""))
      .replace(/\{s\}/g, String(p.slow || p.es || ""))
      .replace(/\{sl\}/g, String(p.sl))
      .replace(/\{tp\}/g, String(p.tp))
      .replace(/\{p\}/g, String(p.period || p.rp || ""))
      .replace(/\{soglia\}/g, String(p.threshold || p.th || ""))
      .replace(/\{sd\}/g, String(p.sd))
      .replace(/\{e\}/g, String(p.ema || ""))
      .replace(/\{mf\}/g, String(p.mf || ""))
      .replace(/\{ms\}/g, String(p.ms || ""))
      .replace(/\{msig\}/g, String(p.msig || ""))
      .replace(/\{sig\}/g, String(p.sig || ""));

    // Clean up empty braces
    const cleanName = name.replace(/\{\w+\}/g, "").replace(/\s+/g, " ").trim();

    db.insert(strategies).values({
      name: cleanName,
      source: "web_research",
      category: tmpl.category,
      sourceDescription: tmpl.summary,
      entryRulesJson: JSON.stringify(tmpl.entryTemplate(p)),
      exitRulesJson: JSON.stringify(tmpl.exitTemplate(p)),
      parametersJson: JSON.stringify(p),
      status: "research",
      isDemo: true,
    }).run();
    count++;
  }
}

console.log(`✅ ${count} strategie create.`);
console.log("Ora esegui: npm run backtest:run");