import { runBacktest, StrategyRules, BacktestParams } from "@/backtest/engine";
import { scoreBacktest } from "@/backtest/scorer";
import { getCandles } from "@/market-data";
import db, { backtestRuns, backtestTrades, strategies } from "@/db";
import { eq } from "drizzle-orm";

const DEFAULT_BT_PARAMS: BacktestParams = {
  initialCapital: 10000,
  commissionPct: 0.1,
  slippagePct: 0.05,
  positionSizePct: 10,
};

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT"];
const TIMEFRAMES = ["15m", "1h", "4h"];

async function main() {
  // Cancella vecchi risultati
  db.delete(backtestRuns).run();
  db.delete(backtestTrades).run();
  try { db.run("DELETE FROM sqlite_sequence WHERE name IN ('backtest_runs','backtest_trades')"); } catch {}

  const allStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.status, "paper_active"));

  console.log(`Backtest engine ufficiale su ${allStrategies.length} strategie paper_active\n`);

  let total = 0;
  let passed = 0;

  for (const s of allStrategies) {
    const rules: StrategyRules = {
      entry: JSON.parse(s.entryRulesJson),
      exit: JSON.parse(s.exitRulesJson),
    };

    // Direzione esplicita dalla strategia (se presente in parametersJson)
    let explicitDirection: "long" | "short" | null = null;
    try {
      const params = JSON.parse(s.parametersJson);
      if (params.direction === "long" || params.direction === "short") {
        explicitDirection = params.direction;
      }
    } catch { /* ignora */ }

    console.log(`\n${s.name}`);

    for (const asset of ASSETS) {
      for (const tf of TIMEFRAMES) {
        try {
          const now = new Date();
          const days = tf === "15m" ? 60 : tf === "1h" ? 120 : 180;
          const from = new Date(now.getTime() - days * 86400000);

          const candles = await getCandles(asset, tf, from, now, "bitget");
          if (candles.length < 50) {
            console.log(`   Dati insufficienti ${asset} ${tf}: ${candles.length}`);
            continue;
          }

          const splitIdx = Math.floor(candles.length * 0.7);
          const isCandles = candles.slice(0, splitIdx);
          const oosCandles = candles.slice(splitIdx);

          const isResult = runBacktest(isCandles, rules, DEFAULT_BT_PARAMS, explicitDirection);
          const oosResult = runBacktest(oosCandles, rules, DEFAULT_BT_PARAMS, explicitDirection);

          const isScore = scoreBacktest(isResult, false);
          const oosScore = scoreBacktest(oosResult, true);

          // Salva IS
          db.insert(backtestRuns).values({
            strategyId: s.id, asset, timeframe: tf,
            periodStart: from.toISOString(), periodEnd: now.toISOString(),
            isOutOfSample: false,
            sharpeRatio: isResult.sharpeRatio, maxDrawdown: isResult.maxDrawdown,
            winRate: isResult.winRate, profitFactor: isResult.profitFactor,
            tradeCount: isResult.tradeCount, totalReturn: isResult.totalReturn,
            passed: isScore.passed,
            rawResultsJson: JSON.stringify(isResult),
          }).run();

          // Salva OOS
          db.insert(backtestRuns).values({
            strategyId: s.id, asset, timeframe: tf,
            periodStart: from.toISOString(), periodEnd: now.toISOString(),
            isOutOfSample: true,
            sharpeRatio: oosResult.sharpeRatio, maxDrawdown: oosResult.maxDrawdown,
            winRate: oosResult.winRate, profitFactor: oosResult.profitFactor,
            tradeCount: oosResult.tradeCount, totalReturn: oosResult.totalReturn,
            passed: oosScore.passed,
            rawResultsJson: JSON.stringify(oosResult),
          }).run();

          const icon = isScore.passed && oosScore.passed ? "OK" : "NO";
          console.log(`   ${icon} ${asset} ${tf}: ${isResult.tradeCount}t, ${(isResult.winRate*100).toFixed(0)}% win, ${isResult.totalReturn.toFixed(0)}$ PnL, score ${isScore.score}/${oosScore.score}`);
          total++;
          if (isScore.passed && oosScore.passed) passed++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`   Warning ${asset} ${tf}: ${msg.slice(0, 80)}`);
        }
      }
    }
  }

  console.log(`\nBacktest completato: ${total} run, ${passed} combinazioni superate`);
}

main().catch(console.error);