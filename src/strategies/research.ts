import db, { strategies } from "@/db";
import { eq } from "drizzle-orm";
import { StrategyRules, BacktestParams } from "@/backtest/engine";

// Strategy research module — searches the web for documented trading strategies
// and saves them to the database with proper attribution.

export interface ResearchResult {
  name: string;
  category: string;
  sourceUrl: string;
  summary: string;
  entryRules: StrategyRules["entry"];
  exitRules: StrategyRules["exit"];
  parameters: Record<string, number>;
  btParams: BacktestParams;
}

// Default backtest params
const DEFAULT_BT_PARAMS: BacktestParams = {
  initialCapital: 10000,
  commissionPct: 0.1,
  slippagePct: 0.05,
  positionSizePct: 10,
};

// Built-in strategies that come from documented sources
// These are pre-loaded for the seed process
export const BUILT_IN_STRATEGIES: ResearchResult[] = [
  {
    name: "EMA Crossover 20/50",
    category: "trend_following",
    sourceUrl: "https://www.investopedia.com/articles/active-trading/052014/how-use-moving-average-crossover-trading.asp",
    summary:
      "Strategia di trend-following basata sul crossover di due medie mobili esponenziali (EMA). Quando la EMA rapida (20 periodi) incrocia al di sopra della EMA lenta (50 periodi), si genera un segnale long. Quando incrocia al di sotto, si genera un segnale short. È una delle strategie più documentate nel trading algoritmico. Fonte: Investopedia — 'How to Use a Moving Average Crossover to Trade'.",
    entryRules: [
      {
        indicator: "ma_crossover",
        params: { fastPeriod: 20, slowPeriod: 50 },
        condition: "crosses_above",
        target: 0,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 10 } },
    ],
    parameters: { fastPeriod: 20, slowPeriod: 50, slPct: 5, tpPct: 10 },
    btParams: { ...DEFAULT_BT_PARAMS },
  },
  {
    name: "RSI Mean Reversion 14/30/70",
    category: "mean_reversion",
    sourceUrl: "https://www.investopedia.com/terms/r/rsi.asp",
    summary:
      "Strategia di mean reversion basata sul Relative Strength Index (RSI) a 14 periodi. Entra long quando RSI scende sotto 30 (ipervenduto) e torna sopra 30. Entra short quando RSI sale sopra 70 (ipercomprato) e torna sotto 70. Fonte: Investopedia — 'Relative Strength Index (RSI) Indicator'.",
    entryRules: [
      {
        indicator: "rsi",
        params: { period: 14 },
        condition: "btwn",
        target: 30,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 8 } },
      { type: "indicator", params: {} },
    ],
    parameters: { rsiPeriod: 14, oversold: 30, overbought: 70, slPct: 5, tpPct: 8 },
    btParams: { ...DEFAULT_BT_PARAMS },
  },
  {
    name: "MACD Histogram Trend",
    category: "momentum",
    sourceUrl: "https://www.investopedia.com/terms/m/macd.asp",
    summary:
      "Strategia momentum basata sull'istogramma MACD (12, 26, 9). Entra long quando l'istogramma MACD diventa positivo (la MACD line incrocia sopra la signal line). Entra short quando l'istogramma diventa negativo. Fonte: Investopedia — 'Moving Average Convergence Divergence (MACD)'.",
    entryRules: [
      {
        indicator: "macd",
        params: { fast: 12, slow: 26, signal: 9 },
        condition: "crosses_above",
        target: 0,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 12 } },
    ],
    parameters: { macdFast: 12, macdSlow: 26, macdSignal: 9, slPct: 5, tpPct: 12 },
    btParams: { ...DEFAULT_BT_PARAMS },
  },
  {
    name: "Bollinger Bands Bounce",
    category: "mean_reversion",
    sourceUrl: "https://www.investopedia.com/articles/technical/102201.asp",
    summary:
      "Strategia di mean reversion basata sulle Bollinger Bands (20, 2). Entra long quando il prezzo tocca o supera la banda inferiore (ipervenduto). Entra short quando tocca o supera la banda superiore (ipercomprato). Fonte: Investopedia — 'Trading Bollinger Bands'.",
    entryRules: [
      {
        indicator: "bbands",
        params: { period: 20, stdDev: 2 },
        condition: "below",
        target: 0.2,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { bbPeriod: 20, bbStdDev: 2, slPct: 5, tpPct: 8 },
    btParams: { ...DEFAULT_BT_PARAMS },
  },
  {
    name: "Volume Breakout 20/2x",
    category: "breakout",
    sourceUrl: "https://www.investopedia.com/articles/technical/02/050602.asp",
    summary:
      "Strategia di breakout basata sul volume. Entra long quando il volume supera 2x la media mobile a 20 periodi e il prezzo è sopra la EMA 20. Fonte: Investopedia — 'Volume Confirms Price Movements'.",
    entryRules: [
      {
        indicator: "volume",
        params: { period: 20 },
        condition: "above",
        target: 2,
      },
      {
        indicator: "ma_crossover",
        params: { fastPeriod: 10, slowPeriod: 20 },
        condition: "above",
        target: 0,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 6 } },
      { type: "tp", params: { pct: 12 } },
    ],
    parameters: { volPeriod: 20, volMultiplier: 2, emaFast: 10, emaSlow: 20, slPct: 6, tpPct: 12 },
    btParams: { ...DEFAULT_BT_PARAMS, positionSizePct: 8 },
  },
  // ─── Scalping Strategy 1: UT Bot + Trend Filter ─────────────────────────
  {
    name: "SCALP UT Bot ATR10/2 EMA200",
    category: "scalping",
    sourceUrl: "https://www.quantum-algo.com/blog/guides/ut-bot-alerts-complete-guide/",
    summary:
      "Strategia di scalping basata su UT Bot (ATR trailing stop con key value 2, ATR 10 periodi) con filtro trend EMA 200. Entra LONG quando UT Bot è bullish (valore = 1) e prezzo sopra EMA 200. Entra SHORT quando UT Bot è bearish (valore = -1) e prezzo sotto EMA 200. UT Bot flips on close — non repaint. Fonte: Quantum Algo — 'UT Bot Alerts: Complete Trading Guide (2026)'.",
    entryRules: [
      {
        indicator: "ut_bot",
        params: { atrPeriod: 10, keyValue: 2 },
        condition: "above",
        target: 0.5,
      },
      {
        indicator: "ema_price",
        params: { period: 200 },
        condition: "above",
        target: 0,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 1.5 } },
      { type: "tp", params: { pct: 3.0 } },
      { type: "time", params: { bars: 48 } },
    ],
    parameters: { atrPeriod: 10, keyValue: 2, emaPeriod: 200, slPct: 1.5, tpPct: 3.0, timeExitBars: 48 },
    btParams: { ...DEFAULT_BT_PARAMS, positionSizePct: 8 },
  },
  // ─── Scalping Strategy 2: MACD Histogram + PSAR + EMA200 ────────────────
  {
    name: "SCALP MACD12/26/9 PSAR EMA200",
    category: "scalping",
    sourceUrl: "https://daviddtech.medium.com/70-win-rate-highly-profitable-macd-parabolic-sar-200-ema-trading-strategy-8f49f8503aa",
    summary:
      "Strategia di scalping con 70% win rate documentato. Entra LONG quando MACD histogram incrocia sopra 0, PSAR è sotto la candela (uptrend, valore = 1), e prezzo sopra EMA 200. Entra SHORT quando MACD histogram incrocia sotto 0, PSAR sopra la candela (downtrend, valore = -1), e prezzo sotto EMA 200. RR 2:1. Fonte: DaviddTech — '70% Win Rate MACD + Parabolic SAR + 200 EMA'.",
    entryRules: [
      {
        indicator: "macd",
        params: { fast: 12, slow: 26, signal: 9 },
        condition: "crosses_above",
        target: 0,
      },
      {
        indicator: "psar",
        params: { step: 0.02, maxStep: 0.2 },
        condition: "above",
        target: 0.5,
      },
      {
        indicator: "ema_price",
        params: { period: 200 },
        condition: "above",
        target: 0,
      },
    ],
    exitRules: [
      { type: "sl", params: { pct: 1.5 } },
      { type: "tp", params: { pct: 3.0 } },
      { type: "time", params: { bars: 96 } },
    ],
    parameters: { macdFast: 12, macdSlow: 26, macdSignal: 9, psarStep: 0.02, psarMaxStep: 0.2, emaPeriod: 200, slPct: 1.5, tpPct: 3.0, timeExitBars: 96 },
    btParams: { ...DEFAULT_BT_PARAMS, positionSizePct: 8 },
  },
];

export async function saveResearchStrategy(result: ResearchResult): Promise<number> {
  const existing = await db
    .select()
    .from(strategies)
    .where(eq(strategies.name, result.name))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Strategy "${result.name}" already exists, skipping`);
    return existing[0].id;
  }

  const res = await db.insert(strategies).values({
    name: result.name,
    source: "web_research",
    category: result.category as any,
    sourceDescription: result.summary,
    entryRulesJson: JSON.stringify(result.entryRules),
    exitRulesJson: JSON.stringify(result.exitRules),
    parametersJson: JSON.stringify(result.parameters),
    sourceUrl: result.sourceUrl,
    status: "research",
    isDemo: true,
  });

  return Number(res.lastInsertRowid);
}

export async function researchWebStrategies(): Promise<number> {
  let count = 0;
  for (const strategy of BUILT_IN_STRATEGIES) {
    const id = await saveResearchStrategy(strategy);
    if (id) count++;
  }
  return count;
}