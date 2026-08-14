import { Candle } from "@/market-data/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BacktestParams {
  initialCapital: number;
  commissionPct: number;
  slippagePct: number;
  positionSizePct: number;
}

export interface StrategyRules {
  entry: EntryRule[];
  exit: ExitRule[];
}

export interface EntryRule {
  indicator: "ma_crossover" | "rsi" | "macd" | "bbands" | "volume" | "price_change" | "candle_direction" | "psar" | "ut_bot" | "ema_price";
  params: Record<string, number>;
  condition: "above" | "below" | "crosses_above" | "crosses_below" | "btwn";
  target?: number;
}

export interface ExitRule {
  type: "sl" | "tp" | "trailing" | "indicator" | "time";
  params: Record<string, number>;
}

export interface BacktestTrade {
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number | null;
  entryTime: number;
  exitTime: number | null;
  pnl: number | null;
  pnlPct: number | null;
  exitReason: string | null;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  finalEquity: number;
  equityCurve: { time: number; equity: number }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function atr(candles: Candle[], period: number): number[] {
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  // RMA (Wilder's smoothed ATR)
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

function psar(candles: Candle[], step: number, maxStep: number): number[] {
  // Returns +1 for uptrend (dots below), -1 for downtrend (dots above), 0 for first bars
  const result: number[] = [0];
  let isUp = false;
  let ep = candles[0].low;
  let sar = candles[0].high;
  let af = step;
  for (let i = 1; i < candles.length; i++) {
    if (isUp) {
      sar = sar + af * (ep - sar);
      if (sar > candles[i].low) {
        // Flip to downtrend
        isUp = false;
        sar = ep;
        ep = candles[i].low;
        af = step;
      } else {
        if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(af + step, maxStep); }
        if (sar > candles[i - 1].low) sar = candles[i - 1].low;
      }
    } else {
      sar = sar + af * (ep - sar);
      if (sar < candles[i].high) {
        // Flip to uptrend
        isUp = true;
        sar = ep;
        ep = candles[i].high;
        af = step;
      } else {
        if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(af + step, maxStep); }
        if (sar < candles[i - 1].high) sar = candles[i - 1].high;
      }
    }
    result.push(isUp ? 1 : -1);
  }
  return result;
}

function rsi(values: number[], period: number): number[] {
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    changes.push(values[i] - values[i - 1]);
  }
  const gains: number[] = [];
  const losses: number[] = [];
  for (const c of changes) {
    gains.push(c > 0 ? c : 0);
    losses.push(c < 0 ? -c : 0);
  }
  const avgGain = sma(gains, period);
  const avgLoss = sma(losses, period);
  const rs = avgGain.map((g, i) => (avgLoss[i] === 0 ? 100 : g / avgLoss[i]));
  return rs.map((r) => 100 - 100 / (1 + r));
}

function macd(values: number[], fast: number, slow: number, signal: number) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  // Align: MACD computed from same index
  const macdLine: number[] = [];
  for (let i = 0; i < Math.min(emaFast.length, emaSlow.length); i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - (signalLine[i] || 0));
  return { macdLine, signalLine, histogram };
}

function bollinger(values: number[], period: number, stdDev: number) {
  const mid = sma(values, period);
  const bands: { upper: number; lower: number }[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    bands.push({ upper: mean + stdDev * std, lower: mean - stdDev * std });
  }
  return { mid, bands };
}

// ─── Entry Rules Evaluator ──────────────────────────────────────────────────

function invertEntryCondition(condition: EntryRule["condition"]): EntryRule["condition"] {
  switch (condition) {
    case "above": return "below";
    case "below": return "above";
    case "crosses_above": return "crosses_below";
    case "crosses_below": return "crosses_above";
    default: return condition;
  }
}

function evaluateEntry(
  rule: EntryRule,
  candles: Candle[],
  idx: number,
  indicators: Record<string, number[]>
): boolean {
  const { indicator, params, condition, target } = rule;
  const val = getIndicator(indicator, candles, idx, params, indicators);
  if (val === null) return false;

  switch (condition) {
    case "above": return val > (target ?? 0);
    case "below": return val < (target ?? 0);
    case "crosses_above": {
      const prev = getIndicator(indicator, candles, idx - 1, params, indicators);
      return prev !== null && prev <= (target ?? 0) && val > (target ?? 0);
    }
    case "crosses_below": {
      const prev = getIndicator(indicator, candles, idx - 1, params, indicators);
      return prev !== null && prev >= (target ?? 0) && val < (target ?? 0);
    }
    case "btwn": {
      const lo = target ?? 30;
      const hi = params.upper ?? 70;
      return val > lo && val < hi;
    }
    default: return false;
  }
}

function getIndicator(
  indicator: string,
  candles: Candle[],
  idx: number,
  params: Record<string, number>,
  indicators: Record<string, number[]>
): number | null {
  if (idx < 0 || idx >= candles.length) return null;

  switch (indicator) {
    case "ma_crossover": {
      const fastP = params.fastPeriod ?? 10;
      const slowP = params.slowPeriod ?? 30;
      const key = `ma_cross_${fastP}_${slowP}`;
      if (!indicators[key]) {
        const fast = ema(candles.map(c => c.close), fastP);
        const slow = sma(candles.map(c => c.close), slowP);
        indicators[key] = candles.map((_, i) => {
          const f = fast[i - (fastP - 1)] ?? 0;
          const s = slow[i - (slowP - 1)] ?? 0;
          return f - s;
        });
      }
      return indicators[key][idx] ?? null;
    }
    case "rsi": {
      const p = params.period ?? 14;
      const key = `rsi_${p}`;
      if (!indicators[key]) {
        indicators[key] = rsi(candles.map(c => c.close), p);
      }
      const offset = candles.length - indicators[key].length;
      return indicators[key][idx - offset] ?? null;
    }
    case "macd": {
      const f = params.fast ?? 12, s = params.slow ?? 26, sig = params.signal ?? 9;
      const key = `macd_${f}_${s}_${sig}`;
      if (!indicators[key]) {
        const res = macd(candles.map(c => c.close), f, s, sig);
        indicators[key] = res.histogram;
      }
      const offset = candles.length - indicators[key].length;
      return indicators[key][idx - offset] ?? null;
    }
    case "bbands": {
      const p = params.period ?? 20, sd = params.stdDev ?? 2;
      const key = `bbands_${p}_${sd}`;
      if (!indicators[key]) {
        const res = bollinger(candles.map(c => c.close), p, sd);
        indicators[key] = candles.map((c, i) => {
          const band = res.bands[i - (p - 1)];
          if (!band) return 0;
          return (c.close - band.lower) / (band.upper - band.lower);
        });
      }
      return indicators[key][idx] ?? null;
    }
    case "volume": {
      const p = params.period ?? 20;
      const key = `vol_avg_${p}`;
      if (!indicators[key]) {
        const volAvg = sma(candles.map(c => c.volume), p);
        const full = candles.map((c, i) => {
          const avg = volAvg[i - (p - 1)] ?? 1;
          return c.volume / avg;
        });
        indicators[key] = full;
      }
      return indicators[key][idx] ?? null;
    }
    case "psar": {
      const step = params.step ?? 0.02;
      const maxStep = params.maxStep ?? 0.2;
      const key = `psar_${step}_${maxStep}`;
      if (!indicators[key]) {
        indicators[key] = psar(candles, step, maxStep);
      }
      return indicators[key][idx] ?? null;
    }
    case "ut_bot": {
      const atrPeriod = params.atrPeriod ?? 10;
      const keyValue = params.keyValue ?? 2;
      const key = `utbot_${atrPeriod}_${keyValue}`;
      if (!indicators[key]) {
        const atrVals = atr(candles, atrPeriod);
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const trail: number[] = [0];
        let isUp = false;
        indicators[key] = [0]; // first bar = 0 (neutral)
        for (let i = 1; i < candles.length; i++) {
          const atrIdx = i - 1; // ATR starts at index 0 = candle 1
          const dist = (atrVals[atrIdx] ?? 0) * keyValue;
          if (isUp) {
            const newStop = Math.max(trail[i - 1] ?? 0, closes[i] - dist);
            trail.push(newStop);
            if (closes[i] < newStop) {
              // Flip to downtrend
              isUp = false;
              indicators[key].push(-1);
              trail[i] = closes[i] + dist;
            } else {
              indicators[key].push(1);
            }
          } else {
            const newStop = Math.min(trail[i - 1] ?? Infinity, closes[i] + dist);
            trail.push(newStop);
            if (closes[i] > newStop) {
              // Flip to uptrend
              isUp = true;
              indicators[key].push(1);
              trail[i] = closes[i] - dist;
            } else {
              indicators[key].push(-1);
            }
          }
        }
      }
      return indicators[key][idx] ?? null;
    }
    case "ema_price": {
      const p = params.period ?? 200;
      const key = `ema_price_${p}`;
      if (!indicators[key]) {
        const emaVals = ema(candles.map(c => c.close), p);
        const full = candles.map((c, i) => {
          const e = emaVals[i - (p - 1)];
          if (e === undefined) return 0;
          return (c.close - e) / e * 100;
        });
        indicators[key] = full;
      }
      return indicators[key][idx] ?? null;
    }
    case "price_change": {
      const p = params.periods ?? 3;
      const key = `pc_${p}`;
      if (!indicators[key]) {
        const closes = candles.map(c => c.close);
        indicators[key] = closes.map((_, i) => {
          if (i < p) return 0;
          return (closes[i] - closes[i - p]) / closes[i - p] * 100;
        });
      }
      return indicators[key][idx] ?? null;
    }
    default: return null;
  }
}

// ─── Main Backtest Engine ───────────────────────────────────────────────────

export function runBacktest(
  candles: Candle[],
  rules: StrategyRules,
  params: BacktestParams,
  explicitDirection?: "long" | "short" | null,
): BacktestResult {
  const { entry, exit } = rules;
  const { initialCapital, commissionPct, positionSizePct } = params;

  let equity = initialCapital;
  let position: { side: "long" | "short"; entryPrice: number; entryTime: number; size: number; entryIdx: number } | null = null;
  const trades: BacktestTrade[] = [];
  const equityCurve: { time: number; equity: number }[] = [];
  const indicators: Record<string, number[]> = {};

  for (let i = 50; i < candles.length; i++) {
    const candle = candles[i];
    equityCurve.push({ time: candle.timestamp, equity });

    if (position) {
      // Check exit rules
      let exitPrice: number | null = null;
      let exitReason: string | null = null;

      for (const ex of exit) {
        switch (ex.type) {
          case "sl": {
            const slPct = ex.params.pct ?? 5;
            if (position.side === "long" && candle.low <= position.entryPrice * (1 - slPct / 100)) {
              exitPrice = position.entryPrice * (1 - slPct / 100);
              exitReason = "stop_loss";
            } else if (position.side === "short" && candle.high >= position.entryPrice * (1 + slPct / 100)) {
              exitPrice = position.entryPrice * (1 + slPct / 100);
              exitReason = "stop_loss";
            }
            break;
          }
          case "tp": {
            const tpPct = ex.params.pct ?? 10;
            if (position.side === "long" && candle.high >= position.entryPrice * (1 + tpPct / 100)) {
              exitPrice = position.entryPrice * (1 + tpPct / 100);
              exitReason = "take_profit";
            } else if (position.side === "short" && candle.low <= position.entryPrice * (1 - tpPct / 100)) {
              exitPrice = position.entryPrice * (1 - tpPct / 100);
              exitReason = "take_profit";
            }
            break;
          }
          case "trailing": {
            // Simplified trailing: check if price moved against position by trailing%
            // In a real engine, track highest/lowest since entry
            break;
          }
          case "indicator": {
            // Check reverse signal
            const reverseEntry = entry.find(e => {
              if (position!.side === "long") {
                return evaluateEntry(e, candles, i, indicators);
              }
              return false;
            });
            if (reverseEntry) {
              exitPrice = candle.close;
              exitReason = "reverse_signal";
            }
            break;
          }
          case "time": {
            const bars = ex.params.bars ?? 100;
            if (i - position.entryIdx >= bars) {
              exitPrice = candle.close;
              exitReason = "time_exit";
            }
            break;
          }
        }
        if (exitPrice !== null) break;
      }

      if (exitPrice !== null) {
        // Close position
        const pnl = position.side === "long"
          ? (exitPrice - position.entryPrice) / position.entryPrice * position.size
          : (position.entryPrice - exitPrice) / position.entryPrice * position.size;
        const fee = position.size * (commissionPct / 100) * 2; // entry + exit
        const netPnl = pnl - fee;
        equity += netPnl;

        trades.push({
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice,
          entryTime: position.entryTime,
          exitTime: candle.timestamp,
          pnl: netPnl,
          pnlPct: (netPnl / position.size) * 100,
          exitReason,
        });

        position = null;
      }
    }

    if (!position && i < candles.length - 1) {
      // Determine side from entry rules: if any rule has crosses_below or below, it's short
      const hasBearishEntry = entry.some(e => e.condition === "crosses_below" || e.condition === "below");
      const hasBullishEntry = entry.some(e => e.condition === "crosses_above" || e.condition === "above");
      const isBidirectional = entry.some(e => e.condition === "btwn");

      // When explicitDirection is provided, ONLY check that direction
      if (explicitDirection === "long") {
        // For MACD LONG v2: use entry rules as-is (crosses_above for long)
        const allEntry = entry.every(e => evaluateEntry(e, candles, i, indicators));
        if (allEntry) {
          const size = equity * (positionSizePct / 100);
          const fee = size * (commissionPct / 100);
          equity -= fee;
          position = {
            side: "long",
            entryPrice: candle.close,
            entryTime: candle.timestamp,
            size,
            entryIdx: i,
          };
        }
      } else if (explicitDirection === "short") {
        // For MACD SHORT v2: entry rules are already crosses_below, use as-is
        const allEntry = entry.every(e => evaluateEntry(e, candles, i, indicators));
        if (allEntry) {
          const size = equity * (positionSizePct / 100);
          const fee = size * (commissionPct / 100);
          equity -= fee;
          position = {
            side: "short",
            entryPrice: candle.close,
            entryTime: candle.timestamp,
            size,
            entryIdx: i,
          };
        }
      } else {
        // No explicit direction: original behaviour (bidirectional from rules)
        // Evaluate entry for long
        if (hasBullishEntry || isBidirectional) {
          const allEntry = entry.every(e => evaluateEntry(e, candles, i, indicators));
          if (allEntry && hasBullishEntry) {
            const size = equity * (positionSizePct / 100);
            const fee = size * (commissionPct / 100);
            equity -= fee;
            position = {
              side: "long",
              entryPrice: candle.close,
              entryTime: candle.timestamp,
              size,
              entryIdx: i,
            };
          }
        }

        // Evaluate entry for short (invert conditions)
        if (!position && (hasBearishEntry || isBidirectional)) {
          const invEntry: EntryRule[] = entry.map(e => ({
            ...e,
            condition: invertEntryCondition(e.condition),
          }));
          const allInvEntry = invEntry.every(e => evaluateEntry(e, candles, i, indicators));
          if (allInvEntry) {
            const size = equity * (positionSizePct / 100);
            const fee = size * (commissionPct / 100);
            equity -= fee;
            position = {
              side: "short",
              entryPrice: candle.close,
              entryTime: candle.timestamp,
              size,
              entryIdx: i,
            };
          }
        }
      }
    }
  }

  // Close any open position at last candle
  if (position) {
    const lastPrice = candles[candles.length - 1].close;
    const pnl = position.side === "long"
      ? (lastPrice - position.entryPrice) / position.entryPrice * position.size
      : (position.entryPrice - lastPrice) / position.entryPrice * position.size;
    const fee = position.size * (commissionPct / 100);
    const netPnl = pnl - fee;
    equity += netPnl;

    trades.push({
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: lastPrice,
      entryTime: position.entryTime,
      exitTime: candles[candles.length - 1].timestamp,
      pnl: netPnl,
      pnlPct: (netPnl / position.size) * 100,
      exitReason: "end_of_data",
    });
  }

  // Calculate metrics
  const totalReturn = equity - initialCapital;
  const totalReturnPct = (totalReturn / initialCapital) * 100;
  const tradeCount = trades.length;

  // Max drawdown
  let peak = initialCapital;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = (peak - point.equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Win rate
  const wins = trades.filter(t => t.pnl !== null && t.pnl > 0);
  const winRate = tradeCount > 0 ? wins.length / tradeCount : 0;

  // Profit factor
  const grossProfit = trades.reduce((s, t) => s + (t.pnl && t.pnl > 0 ? t.pnl : 0), 0);
  const grossLoss = trades.reduce((s, t) => s + (t.pnl && t.pnl < 0 ? Math.abs(t.pnl) : 0), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 1;

  // Sharpe ratio (annualized, using daily returns)
  const dailyReturns: number[] = [];
  // Simplified: compute per-candle return
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
    dailyReturns.push(ret);
  }
  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

  return {
    trades,
    totalReturn,
    totalReturnPct,
    maxDrawdown,
    sharpeRatio,
    winRate,
    profitFactor,
    tradeCount,
    finalEquity: equity,
    equityCurve,
  };
}