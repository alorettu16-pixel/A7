import { Candle } from "@/market-data/types";
import { StrategyRules, BacktestParams, runBacktest, BacktestResult } from "@/backtest/engine";
import { scoreBacktest, ScoredStrategy } from "@/backtest/scorer";
import { getCandles } from "@/market-data";

export interface FullBacktestReport {
  inSample: { result: BacktestResult; score: ScoredStrategy } | null;
  outOfSample: { result: BacktestResult; score: ScoredStrategy } | null;
  passed: boolean;
  overallScore: number;
  tradeCount: number;
}

export async function runFullBacktest(
  asset: string,
  timeframe: string,
  rules: StrategyRules,
  btParams: BacktestParams,
  _isDemo: boolean = true
): Promise<FullBacktestReport> {
  const now = new Date();
  // Use 90 days for 15m, 120 for 1h, 180 for 4h
  const days = timeframe === "15m" ? 60 : timeframe === "1h" ? 120 : 180;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const candles = await getCandles(asset, timeframe, from, now, "bitget");
  if (candles.length < 100) {
    throw new Error(`Dati insufficienti per ${asset} ${timeframe}: solo ${candles.length} candele`);
  }

  const splitIdx = Math.floor(candles.length * 0.7);
  const inSampleCandles = candles.slice(0, splitIdx);
  const outOfSampleCandles = candles.slice(splitIdx);

  const inSampleResult = runBacktest(inSampleCandles, rules, btParams);
  const inSampleScore = scoreBacktest(inSampleResult, false);

  const outOfSampleResult = runBacktest(outOfSampleCandles, rules, btParams);
  const outOfSampleScore = scoreBacktest(outOfSampleResult, true);

  const passed = inSampleScore.passed && outOfSampleScore.passed;
  const overallScore = (inSampleScore.score + outOfSampleScore.score) / 2;
  const tradeCount = inSampleResult.tradeCount + outOfSampleResult.tradeCount;

  return {
    inSample: { result: inSampleResult, score: inSampleScore },
    outOfSample: { result: outOfSampleResult, score: outOfSampleScore },
    passed,
    overallScore,
    tradeCount,
  };
}