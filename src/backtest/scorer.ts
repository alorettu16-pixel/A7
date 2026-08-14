import { BacktestResult } from "./engine";

export interface ScoredStrategy {
  passed: boolean;
  score: number;
  reasons: string[];
  fatalIssues: string[];
}

const MIN_SHARPE = 0.1;
const MAX_DRAWDOWN = 0.40;
const MIN_TRADES_IS = 5;
const MIN_TRADES_OOS = 5;
const MIN_WIN_RATE = 0.25;
const MIN_PROFIT_FACTOR = 1.0;

export function scoreBacktest(
  result: BacktestResult,
  isOutOfSample: boolean
): ScoredStrategy {
  const reasons: string[] = [];
  const fatalIssues: string[] = [];

  if (result.tradeCount === 0) {
    return {
      passed: false,
      score: 0,
      reasons: [],
      fatalIssues: ["Nessuna operazione generata — strategia non produce segnali"],
    };
  }

  // Score components (each 0-20)
  let score = 0;

  // Sharpe ratio (max 20)
  const sharpeScore = Math.min(20, Math.max(0, (result.sharpeRatio / 2) * 20));
  score += sharpeScore;
  if (result.sharpeRatio >= MIN_SHARPE) {
    reasons.push(`Sharpe ratio: ${result.sharpeRatio.toFixed(2)} (≥ ${MIN_SHARPE}) ✓`);
  } else {
    const msg = `Sharpe ratio: ${result.sharpeRatio.toFixed(2)} (< ${MIN_SHARPE}) ${isOutOfSample ? "— fallimento OOS" : "— sotto soglia"}`;
    if (isOutOfSample) fatalIssues.push(msg);
    else reasons.push(msg);
  }

  // Max drawdown (max 20, penalty over 30%)
  const ddScore = Math.max(0, 20 * (1 - result.maxDrawdown / 0.5));
  score += ddScore;
  if (result.maxDrawdown <= MAX_DRAWDOWN) {
    reasons.push(`Max drawdown: ${(result.maxDrawdown * 100).toFixed(1)}% (≤ ${MAX_DRAWDOWN * 100}%) ✓`);
  } else {
    const msg = `Max drawdown: ${(result.maxDrawdown * 100).toFixed(1)}% (> ${MAX_DRAWDOWN * 100}%) ${isOutOfSample ? "— fallimento OOS" : "— sotto soglia"}`;
    if (isOutOfSample) fatalIssues.push(msg);
    else reasons.push(msg);
  }

  // Win rate (max 20)
  const wrScore = Math.min(20, result.winRate * 40);
  score += wrScore;
  if (result.winRate >= MIN_WIN_RATE) {
    reasons.push(`Win rate: ${(result.winRate * 100).toFixed(1)}% (≥ ${MIN_WIN_RATE * 100}%) ✓`);
  } else {
    reasons.push(`Win rate: ${(result.winRate * 100).toFixed(1)}% (< ${MIN_WIN_RATE * 100}%)`);
  }

  // Profit factor (max 20)
  const pfScore = Math.min(20, result.profitFactor * 8);
  score += pfScore;
  if (result.profitFactor >= MIN_PROFIT_FACTOR) {
    reasons.push(`Profit factor: ${result.profitFactor.toFixed(2)} (≥ ${MIN_PROFIT_FACTOR}) ✓`);
  } else {
    const msg = `Profit factor: ${result.profitFactor.toFixed(2)} (< ${MIN_PROFIT_FACTOR}) ${isOutOfSample ? "— fallimento OOS" : "— sotto soglia"}`;
    if (isOutOfSample) fatalIssues.push(msg);
    else reasons.push(msg);
  }

  // Trade count (max 20)
  const minTrades = isOutOfSample ? MIN_TRADES_OOS : MIN_TRADES_IS;
  const tcScore = Math.min(20, (result.tradeCount / minTrades) * 20);
  score += tcScore;
  if (result.tradeCount >= minTrades) {
    reasons.push(`Trade count: ${result.tradeCount} (≥ ${minTrades}) ✓`);
  } else {
    const msg = `Trade count: ${result.tradeCount} (< ${minTrades}) — campione insufficiente`;
    if (isOutOfSample) fatalIssues.push(msg);
    else reasons.push(msg);
  }

  const passed = fatalIssues.length === 0 && score >= 50;

  return {
    passed,
    score,
    reasons,
    fatalIssues,
  };
}