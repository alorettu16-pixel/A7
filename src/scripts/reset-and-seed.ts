import db from "../db";
import { strategies } from "../db/schema";
import { eq } from "drizzle-orm";

interface StratDef {
  name: string;
  category: "trend_following" | "mean_reversion" | "breakout" | "momentum" | "grid" | "custom";
  summary: string;
  entryRules: any[];
  exitRules: any[];
  parameters: Record<string, number>;
}

const STRATEGIES: StratDef[] = [
  // ── TREND FOLLOWING (4) ──────────────────────────────────────────────────
  {
    name: "EMA 9/21 + RSI Filtro 50",
    category: "trend_following",
    summary: "Entra long quando EMA 9 incrocia sopra EMA 21 confermato da RSI(14) > 50 (trend rialzista). SL 4%, TP 8%. Fonte: combinazione di crossover MA e RSI trend filter — tecnica documentata su Investopedia.",
    entryRules: [
      { indicator: "ma_crossover", params: { fastPeriod: 9, slowPeriod: 21 }, condition: "crosses_above", target: 0 },
      { indicator: "rsi", params: { period: 14 }, condition: "above", target: 50 },
    ],
    exitRules: [{ type: "sl", params: { pct: 4 } }, { type: "tp", params: { pct: 8 } }],
    parameters: { fastPeriod: 9, slowPeriod: 21, rsiPeriod: 14, rsiFilter: 50, slPct: 4, tpPct: 8 },
  },
  {
    name: "Supertrend 10x3 EMA Confluence",
    category: "trend_following",
    summary: "Strategia trend-following: quando EMA 20 > EMA 50 (trend up) e prezzo sopra EMA 20, entra long. SL 5%, TP 10%. Fonte: tecnica di trend confluenza multi-timeframe adattata da 'Moving Average Confluence Strategy'.",
    entryRules: [
      { indicator: "ma_crossover", params: { fastPeriod: 10, slowPeriod: 20 }, condition: "above", target: 0 },
      { indicator: "ma_crossover", params: { fastPeriod: 20, slowPeriod: 50 }, condition: "above", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { emaFast: 10, emaMid: 20, emaSlow: 50, slPct: 5, tpPct: 10 },
  },
  {
    name: "EMA 20/50 Crossover Classico",
    category: "trend_following",
    summary: "Classico crossover EMA 20/50. Entra long quando EMA 20 incrocia sopra EMA 50. SL 5%, TP 10%. Fonte: tecnica base di trading, documentata in 'Moving Average Crossover' su Investopedia.",
    entryRules: [
      { indicator: "ma_crossover", params: { fastPeriod: 20, slowPeriod: 50 }, condition: "crosses_above", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { fastPeriod: 20, slowPeriod: 50, slPct: 5, tpPct: 10 },
  },
  {
    name: "EMA 50/200 Trend Pullback",
    category: "trend_following",
    summary: "Entra long quando EMA 50 > EMA 200 (trend rialzista) e prezzo ritraccia verso EMA 50. SL 4%, TP 10%. Fonte: tecnica di pullback trading su trend primario, 'Moving Average Pullback Strategy'.",
    entryRules: [
      { indicator: "ma_crossover", params: { fastPeriod: 50, slowPeriod: 200 }, condition: "above", target: 0 },
      { indicator: "ma_crossover", params: { fastPeriod: 1, slowPeriod: 50 }, condition: "below", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 4 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { emaFast: 50, emaSlow: 200, slPct: 4, tpPct: 10 },
  },

  // ── MOMENTUM (3) ─────────────────────────────────────────────────────────
  {
    name: "MACD Histogram 12/26/9",
    category: "momentum",
    summary: "Entra long quando istogramma MACD diventa positivo (MACD line > signal line). SL 5%, TP 10%. Fonte: 'MACD Indicator' su Investopedia.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "crosses_above", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { macdFast: 12, macdSlow: 26, macdSignal: 9, slPct: 5, tpPct: 10 },
  },
  {
    name: "MACD + EMA Trend Filter",
    category: "momentum",
    summary: "MACD positivo + prezzo sopra EMA 20. Entra long quando entrambe le condizioni sono vere. SL 5%, TP 10%. Fonte: combinazione MACD momentum + trend filter.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "crosses_above", target: 0 },
      { indicator: "ma_crossover", params: { fastPeriod: 1, slowPeriod: 20 }, condition: "above", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { macdFast: 12, macdSlow: 26, macdSignal: 9, emaPeriod: 20, slPct: 5, tpPct: 10 },
  },
  {
    name: "RSI Momentum 14/60",
    category: "momentum",
    summary: "Entra long quando RSI(14) sale sopra 60 (momentum rialzista confermato). SL 5%, TP 8%. Fonte: 'RSI Momentum Strategy' — entrata su breakout della zona neutrale.",
    entryRules: [
      { indicator: "rsi", params: { period: 14 }, condition: "crosses_above", target: 60 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 8 } }],
    parameters: { rsiPeriod: 14, rsiThreshold: 60, slPct: 5, tpPct: 8 },
  },

  // ── MEAN REVERSION (4) ───────────────────────────────────────────────────
  {
    name: "Bollinger Bands Bounce 20/2",
    category: "mean_reversion",
    summary: "Entra long quando prezzo tocca banda inferiore Bollinger(20,2). SL 3%, TP 6%, time exit 48 barre. Fonte: 'Trading Bollinger Bands' su Investopedia — strategia rimbalzo dalle bande.",
    entryRules: [
      { indicator: "bbands", params: { period: 20, stdDev: 2 }, condition: "below", target: 0.1 },
    ],
    exitRules: [{ type: "sl", params: { pct: 3 } }, { type: "tp", params: { pct: 6 } }, { type: "time", params: { bars: 48 } }],
    parameters: { bbPeriod: 20, bbStdDev: 2, slPct: 3, tpPct: 6 },
  },
  {
    name: "Bollinger + RSI Oversold 30",
    category: "mean_reversion",
    summary: "Entra long quando prezzo tocca banda inferiore Bollinger(20,2) E RSI(14) < 30 (ipervenduto confermato). SL 3%, TP 6%. Fonte: tecnica di confluenza Bollinger + RSI per mean reversion.",
    entryRules: [
      { indicator: "bbands", params: { period: 20, stdDev: 2 }, condition: "below", target: 0.1 },
      { indicator: "rsi", params: { period: 14 }, condition: "below", target: 30 },
    ],
    exitRules: [{ type: "sl", params: { pct: 3 } }, { type: "tp", params: { pct: 6 } }],
    parameters: { bbPeriod: 20, bbStdDev: 2, rsiPeriod: 14, rsiOversold: 30, slPct: 3, tpPct: 6 },
  },
  {
    name: "RSI Extreme 14/25/75",
    category: "mean_reversion",
    summary: "Entra long quando RSI(14) scende sotto 25 (ipervenduto estremo). SL 4%, TP 7%. Fonte: 'RSI Extreme Trading' — entrata su livelli estremi di ipervenduto/ipercomprato.",
    entryRules: [
      { indicator: "rsi", params: { period: 14 }, condition: "btwn", target: 0, upper: 25 },
    ],
    exitRules: [{ type: "sl", params: { pct: 4 } }, { type: "tp", params: { pct: 7 } }],
    parameters: { rsiPeriod: 14, oversold: 25, overbought: 75, slPct: 4, tpPct: 7 },
  },
  {
    name: "RSI Oversold Bounce 14/30",
    category: "mean_reversion",
    summary: "Entra long quando RSI(14) era sotto 30 e torna sopra (rimbalzo da ipervenduto). SL 4%, TP 7%. Fonte: 'RSI Bounce Strategy' — ingressi su inversione da ipervenduto.",
    entryRules: [
      { indicator: "rsi", params: { period: 14 }, condition: "crosses_above", target: 30 },
    ],
    exitRules: [{ type: "sl", params: { pct: 4 } }, { type: "tp", params: { pct: 7 } }],
    parameters: { rsiPeriod: 14, oversoldThreshold: 30, slPct: 4, tpPct: 7 },
  },

  // ── BREAKOUT (3) ─────────────────────────────────────────────────────────
  {
    name: "Volume Breakout 20/1.5x",
    category: "breakout",
    summary: "Entra long quando volume > 1.5x media 20 periodi e prezzo sopra EMA 10. SL 5%, TP 10%. Fonte: 'Volume Breakout Strategy' — volume spike + trend confirmation.",
    entryRules: [
      { indicator: "volume", params: { period: 20 }, condition: "above", target: 1.5 },
      { indicator: "ma_crossover", params: { fastPeriod: 1, slowPeriod: 10 }, condition: "above", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { volPeriod: 20, volMultiplier: 1.5, emaPeriod: 10, slPct: 5, tpPct: 10 },
  },
  {
    name: "Volume Spike 20/2x",
    category: "breakout",
    summary: "Entra long quando volume > 2x media 20 periodi (spike anomalo). SL 6%, TP 12%. Fonte: 'Volume Spike Trading' — entrate su esplosioni di volume anomale.",
    entryRules: [
      { indicator: "volume", params: { period: 20 }, condition: "above", target: 2 },
    ],
    exitRules: [{ type: "sl", params: { pct: 6 } }, { type: "tp", params: { pct: 12 } }],
    parameters: { volPeriod: 20, volMultiplier: 2, slPct: 6, tpPct: 12 },
  },
  {
    name: "MACD Volume Breakout",
    category: "breakout",
    summary: "Entra long quando MACD positivo E volume > 1.5x media. Combinazione momentum + volume breakout. SL 5%, TP 10%.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "above", target: 0 },
      { indicator: "volume", params: { period: 20 }, condition: "above", target: 1.5 },
    ],
    exitRules: [{ type: "sl", params: { pct: 5 } }, { type: "tp", params: { pct: 10 } }],
    parameters: { macdFast: 12, macdSlow: 26, macdSignal: 9, volPeriod: 20, volMultiplier: 1.5, slPct: 5, tpPct: 10 },
  },

  // ── COMBINAZIONE (3) ─────────────────────────────────────────────────────
  {
    name: "EMA 9/21 + MACD + Volume",
    category: "custom",
    summary: "Tripla conferma: EMA 9/21 crossover + MACD positivo + volume > media. Entra long solo quando tutte e 3 confermano. SL 4%, TP 8%. Fonte: 'Triple Confirmation Strategy' — combinazione trend, momentum e volume.",
    entryRules: [
      { indicator: "ma_crossover", params: { fastPeriod: 9, slowPeriod: 21 }, condition: "crosses_above", target: 0 },
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "above", target: 0 },
      { indicator: "volume", params: { period: 20 }, condition: "above", target: 1.2 },
    ],
    exitRules: [{ type: "sl", params: { pct: 4 } }, { type: "tp", params: { pct: 8 } }],
    parameters: { emaFast: 9, emaSlow: 21, macdFast: 12, macdSlow: 26, macdSignal: 9, volPeriod: 20, volMultiplier: 1.2, slPct: 4, tpPct: 8 },
  },
  {
    name: "RSI 30-70 + Bollinger MeanRev",
    category: "custom",
    summary: "Entra long quando RSI esce da ipervenduto (sale sopra 30) E prezzo sotto banda inferiore Bollinger. Doppia conferma mean reversion. SL 3%, TP 6%.",
    entryRules: [
      { indicator: "rsi", params: { period: 14 }, condition: "crosses_above", target: 30 },
      { indicator: "bbands", params: { period: 20, stdDev: 2 }, condition: "below", target: 0.2 },
    ],
    exitRules: [{ type: "sl", params: { pct: 3 } }, { type: "tp", params: { pct: 6 } }],
    parameters: { rsiPeriod: 14, rsiExit: 30, bbPeriod: 20, bbStdDev: 2, slPct: 3, tpPct: 6 },
  },
  {
    name: "EMA 10/20 + MACD Trend Momentum",
    category: "custom",
    summary: "Entra long quando EMA 10 > EMA 20 (trend up) e MACD istogramma positivo. Trend + momentum insieme. SL 4%, TP 8%.",
    entryRules: [
      { indicator: "ma_crossover", params: { fastPeriod: 10, slowPeriod: 20 }, condition: "above", target: 0 },
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "above", target: 0 },
    ],
    exitRules: [{ type: "sl", params: { pct: 4 } }, { type: "tp", params: { pct: 8 } }],
    parameters: { emaFast: 10, emaSlow: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, slPct: 4, tpPct: 8 },
  },
];

// ── CLEAN + SEED ────────────────────────────────────────────────────────────

console.log("🧹 Pulizia strategie esistenti...");
// Delete dependent tables first
db.run('DELETE FROM backtest_trades');
db.run('DELETE FROM backtest_runs');
db.run('DELETE FROM strategy_versions');
db.run('DELETE FROM rule_changes');
db.run('DELETE FROM rule_sets');
db.run('DELETE FROM tradingview_webhook_logs');
db.run('DELETE FROM strategy_signals');
db.run('DELETE FROM decision_journal');
db.run('DELETE FROM paper_trades');
db.run('DELETE FROM pnl_snapshots');
db.run('DELETE FROM outcome_reviews');
db.run('DELETE FROM daily_reports');
db.run('DELETE FROM equity_snapshots');
db.run('DELETE FROM broker_connections');
db.run('DELETE FROM live_trade_logs');
db.delete(strategies).run();
console.log("✅ Strategie e dati correlati cancellati.");

let count = 0;
for (const s of STRATEGIES) {
  db.insert(strategies).values({
    name: s.name,
    source: "web_research",
    category: s.category,
    sourceDescription: s.summary,
    entryRulesJson: JSON.stringify(s.entryRules),
    exitRulesJson: JSON.stringify(s.exitRules),
    parametersJson: JSON.stringify(s.parameters),
    status: "research",
    isDemo: true,
  }).run();
  count++;
  console.log(`  ${count}. ${s.name}`);
}

console.log(`\n✅ ${count} strategie create.`);
console.log("Ora esegui: npm run backtest:run (backtest su BTC/ETH in 15m, 1h, 4h)");