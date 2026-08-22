import { Candle } from "@/market-data/types";
import { StrategyRules, EntryRule } from "@/backtest/engine";

export interface GeneratedSignal {
  asset: string;
  side: "long" | "short";
  price: number;
  timestamp: string;
  strategyId: number;
  confidence: number;
  reason: string;
}

// ─── Trend direction helper ──────────────────────────────────────────────────
function getTrend(closes: number[], period = 200): "bullish" | "bearish" | "neutral" {
  if (closes.length < period + 5) return "neutral";
  const emaVals = computeEMA(closes, period);
  const currentPrice = closes[closes.length - 1];
  const currentEma = emaVals[emaVals.length - 1];
  if (currentPrice === undefined || currentEma === undefined) return "neutral";
  // Also check EMA slope (last 3 bars)
  const prevEma = emaVals[emaVals.length - 3];
  if (prevEma === undefined) return "neutral";
  const slope = (currentEma - prevEma) / prevEma;
  if (currentPrice > currentEma && slope > 0) return "bullish";
  if (currentPrice < currentEma && slope < 0) return "bearish";
  // Prezzo sopra EMA: bullish anche se pendenza zero (mercato salito)
  if (currentPrice > currentEma) return "bullish";
  // Prezzo sotto EMA: bearish anche se pendenza zero (mercato sceso)
  if (currentPrice < currentEma) return "bearish";
  return "neutral";
}

// Pre-compute common indicators
function computeRSI(closes: number[], period: number): number[] {
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain: number[] = [];
  const avgLoss2: number[] = [];
  for (let i = period - 1; i < gains.length; i++) {
    avgGain.push(gains.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period);
    avgLoss2.push(losses.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period);
  }
  return avgGain.map((g, i) => {
    const l = avgLoss2[i] || 0.001;
    return 100 - 100 / (1 + g / l);
  });
}

function computeMACD(closes: number[], fast: number, slow: number, signal: number): number[] {
  const kf = 2 / (fast + 1), ks = 2 / (slow + 1);
  const emaFast: number[] = [closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast];
  const emaSlow: number[] = [closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow];
  for (let i = 1; i < closes.length; i++) {
    emaFast.push(closes[i] * kf + emaFast[i - 1] * (1 - kf));
    emaSlow.push(closes[i] * ks + emaSlow[i - 1] * (1 - ks));
  }
  const macdLine = emaFast.map((v, i) => v - (emaSlow[i] || 0));
  const ksig = 2 / (signal + 1);
  const sigLine: number[] = [macdLine[0]];
  for (let i = 1; i < macdLine.length; i++) {
    sigLine.push(macdLine[i] * ksig + sigLine[i - 1] * (1 - ksig));
  }
  return macdLine.map((v, i) => v - (sigLine[i] || 0));
}

function computeEMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < closes.length; i++) {
    prev = closes[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function computeATR(candles: Candle[], period: number): number[] {
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  const result: number[] = [];
  const k = 1 / period;
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < tr.length; i++) {
    prev = tr[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function computePSAR(candles: Candle[], step: number, maxStep: number): number[] {
  const result: number[] = [0];
  let isUp = false;
  let ep = candles[0].low;
  let sar = candles[0].high;
  let af = step;
  for (let i = 1; i < candles.length; i++) {
    if (isUp) {
      sar = sar + af * (ep - sar);
      if (sar > candles[i].low) {
        isUp = false; sar = ep; ep = candles[i].low; af = step;
      } else {
        if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(af + step, maxStep); }
        if (sar > candles[i - 1].low) sar = candles[i - 1].low;
      }
    } else {
      sar = sar + af * (ep - sar);
      if (sar < candles[i].high) {
        isUp = true; sar = ep; ep = candles[i].high; af = step;
      } else {
        if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(af + step, maxStep); }
        if (sar < candles[i - 1].high) sar = candles[i - 1].high;
      }
    }
    result.push(isUp ? 1 : -1);
  }
  return result;
}

function getIndicatorValue(
  rule: EntryRule,
  closes: number[],
  idx: number,
  cache: Record<string, number[]>,
  candles?: Candle[]
): number | null {
  if (idx < 0 || idx >= closes.length) return null;
  const { indicator, params } = rule;

  switch (indicator) {
    case "ma_crossover": {
      const fastP = params.fastPeriod ?? 10;
      const slowP = params.slowPeriod ?? 30;
      const key = `ma_${fastP}_${slowP}`;
      if (!cache[key]) {
        const fast = closes.map((_, i) => {
          if (i < fastP - 1) return 0;
          return closes.slice(i - fastP + 1, i + 1).reduce((s, c) => s + c, 0) / fastP;
        });
        const slow = closes.map((_, i) => {
          if (i < slowP - 1) return 0;
          return closes.slice(i - slowP + 1, i + 1).reduce((s, c) => s + c, 0) / slowP;
        });
        cache[key] = fast.map((f, i) => f - slow[i]);
      }
      return cache[key][idx] ?? null;
    }
    case "rsi": {
      const p = params.period ?? 14;
      const key = `rsi_${p}`;
      if (!cache[key]) cache[key] = computeRSI(closes, p);
      const offset = closes.length - cache[key].length;
      return cache[key][idx - offset] ?? null;
    }
    case "macd": {
      const f = params.fast ?? 12, s = params.slow ?? 26, sig = params.signal ?? 9;
      const key = `macd_${f}_${s}_${sig}`;
      if (!cache[key]) cache[key] = computeMACD(closes, f, s, sig);
      return cache[key][idx] ?? null;
    }
    case "price_change": {
      const periods = params.periods ?? 3;
      const key = `pc_${periods}`;
      if (!cache[key]) {
        cache[key] = closes.map((_, i) => {
          if (i < periods) return 0;
          return (closes[i] - closes[i - periods]) / closes[i - periods] * 100;
        });
      }
      return cache[key][idx] ?? null;
    }
    case "candle_direction": {
      const key = `cd`;
      if (!cache[key] && candles) {
        cache[key] = candles.map((c) => c.close > c.open ? 1 : (c.close < c.open ? -1 : 0));
      }
      if (!cache[key]) return 0;
      return cache[key][idx] ?? 0;
    }
    case "psar": {
      if (!candles) return null;
      const step = params.step ?? 0.02;
      const maxStep = params.maxStep ?? 0.2;
      const key = `psar_${step}_${maxStep}`;
      if (!cache[key]) cache[key] = computePSAR(candles, step, maxStep);
      return cache[key][idx] ?? null;
    }
    case "ut_bot": {
      if (!candles) return null;
      const atrPeriod = params.atrPeriod ?? 10;
      const keyValue = params.keyValue ?? 2;
      const key = `utbot_${atrPeriod}_${keyValue}`;
      if (!cache[key]) {
        const atrVals = computeATR(candles, atrPeriod);
        const closes = candles.map(c => c.close);
        const trail: number[] = [0];
        let isUp = false;
        cache[key] = [0];
        for (let i = 1; i < candles.length; i++) {
          const atrIdx = i - 1;
          const dist = (atrVals[atrIdx] ?? 0) * keyValue;
          if (isUp) {
            const newStop = Math.max(trail[i - 1] ?? 0, closes[i] - dist);
            trail.push(newStop);
            if (closes[i] < newStop) {
              isUp = false;
              cache[key].push(-1);
              trail[i] = closes[i] + dist;
            } else {
              cache[key].push(1);
            }
          } else {
            const newStop = Math.min(trail[i - 1] ?? Infinity, closes[i] + dist);
            trail.push(newStop);
            if (closes[i] > newStop) {
              isUp = true;
              cache[key].push(1);
              trail[i] = closes[i] - dist;
            } else {
              cache[key].push(-1);
            }
          }
        }
      }
      return cache[key][idx] ?? null;
    }
    case "ema_price": {
      const p = params.period ?? 200;
      const key = `ema_price_${p}`;
      if (!cache[key]) {
        const emaVals = computeEMA(closes, p);
        cache[key] = closes.map((c, i) => {
          const e = emaVals[i - (p - 1)];
          if (e === undefined) return 0;
          return (c - e) / e * 100;
        });
      }
      return cache[key][idx] ?? null;
    }
    default:
      return null;
  }
}

function detectSide(rules: StrategyRules): "long" | "short" {
  const hasBearish = rules.entry.some(
    e => e.condition === "crosses_below" || e.condition === "below"
  );
  const hasBullish = rules.entry.some(
    e => e.condition === "crosses_above" || e.condition === "above"
  );
  if (hasBearish && !hasBullish) return "short";
  return "long";
}

export async function generateSignals(
  strategyId: number,
  rules: StrategyRules,
  asset: string,
  _timeframe: string,
  latestCandles: Candle[],
  alreadyOpenOnAsset?: boolean,
  explicitDirection?: "long" | "short" | null,
): Promise<GeneratedSignal[]> {
  const signals: GeneratedSignal[] = [];
  const cache: Record<string, number[]> = {};
  const closes = latestCandles.map(c => c.close);

  if (alreadyOpenOnAsset) return signals;

  // Determine which sides to check.
  // - explicitDirection (from strategy parameters, e.g. "long"/"short" on MACD v2)
  //   overrides everything and forces a single-direction strategy.
  // - Otherwise derive side from entry-rule conditions: crosses_below/below => short,
  //   crosses_above/above => long, "btwn" => both.
  const defaultSide = detectSide(rules);
  const hasCrossAbove = rules.entry.some(e => e.condition === "crosses_above");
  const hasCrossBelow = rules.entry.some(e => e.condition === "crosses_below");
  const isBidirectional = rules.entry.some(e => e.condition === "btwn");

  let sidesToCheck: ("long" | "short")[];
  if (explicitDirection) {
    sidesToCheck = [explicitDirection];
  } else if (isBidirectional) {
    sidesToCheck = ["long", "short"];
  } else if (!hasCrossAbove && !hasCrossBelow) {
    sidesToCheck = [defaultSide];
  } else if (hasCrossAbove && !hasCrossBelow) {
    sidesToCheck = ["long"];
  } else if (!hasCrossAbove && hasCrossBelow) {
    sidesToCheck = ["short"];
  } else {
    sidesToCheck = ["long", "short"];
  }

  // ─── Trend Filter (EMA200) ───────────────────────────────────────────────
  const trend = getTrend(closes, 200);
  const skipLong = trend === "bearish";
  const skipShort = trend === "bullish";

  for (const checkSide of sidesToCheck) {
    // Skip entries against the trend
    if (checkSide === "long" && skipLong) {
      console.log(`   ⏸ ${asset} MACD: skip LONG (trend bearish, price sotto EMA200)`);
      continue;
    }
    if (checkSide === "short" && skipShort) {
      console.log(`   ⏸ ${asset} MACD: skip SHORT (trend bullish, price sopra EMA200)`);
      continue;
    }

    for (let i = Math.max(5, latestCandles.length - 5); i < latestCandles.length; i++) {
      const allEntry = rules.entry.every((e) => {
        const val = getIndicatorValue(e, closes, i, cache, latestCandles);
        if (val === null) return false;

        const { condition, target } = e;
        // Invert the entry condition only when we are checking an explicit SHORT side
        // whose stored rule is a bullish crossover (so the "crosses_above" rule becomes
        // the short trigger). For a dedicated SHORT strategy the rule is already
        // crosses_below, so no inversion happens.
        const effectiveCondition =
          checkSide === "short" && !hasCrossBelow ? invertCondition(condition) : condition;

        switch (effectiveCondition) {
          case "above": return val > (target ?? 0);
          case "below": return val < (target ?? 0);
          case "crosses_above": {
            const prev = getIndicatorValue(e, closes, i - 1, cache, latestCandles);
            return prev !== null && prev <= (target ?? 0) && val > (target ?? 0);
          }
          case "crosses_below": {
            const prev = getIndicatorValue(e, closes, i - 1, cache, latestCandles);
            return prev !== null && prev >= (target ?? 0) && val < (target ?? 0);
          }
          default: return false;
        }
      });

      if (allEntry) {
        signals.push({
          asset,
          side: checkSide,
          price: latestCandles[i].close,
          timestamp: new Date(latestCandles[i].timestamp).toISOString(),
          strategyId,
          confidence: checkSide === defaultSide ? 0.7 : 0.6,
          reason: checkSide === "long" ? "Segnale entry LONG" : "Segnale entry SHORT",
        });
      }
    }
  }
  return signals;
}

function invertCondition(condition: string): string {
  switch (condition) {
    case "above": return "below";
    case "below": return "above";
    case "crosses_above": return "crosses_below";
    case "crosses_below": return "crosses_above";
    default: return condition;
  }
}