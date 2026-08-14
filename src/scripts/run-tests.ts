// Test runner for A7
// This runs all tests and reports results

import { runBacktest, StrategyRules, BacktestParams } from "@/backtest/engine";
import { scoreBacktest } from "@/backtest/scorer";
import { validateWebhookPayload, checkDuplicate, validateWebhookToken } from "@/webhook/validator";
import { Candle } from "@/market-data/types";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const tests: TestResult[] = [];

function assert(condition: boolean, name: string, error?: string) {
  tests.push({ name, passed: condition, error: error || (condition ? undefined : "Assertion failed") });
}

// ─── Test 1: Backtest engine basic ────────────────────────────────────────

function testBacktestEngine() {
  // Generate synthetic candles
  const candles: Candle[] = [];
  let price = 50000;
  for (let i = 0; i < 500; i++) {
    price += (Math.random() - 0.5) * 500;
    candles.push({
      timestamp: Date.now() - (500 - i) * 3600000,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 100 + Math.random() * 50,
    });
  }

  const rules: StrategyRules = {
    entry: [
      { indicator: "ma_crossover", params: { fastPeriod: 10, slowPeriod: 30 }, condition: "crosses_above", target: 0 },
    ],
    exit: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 10 } },
    ],
  };

  const params: BacktestParams = {
    initialCapital: 10000,
    commissionPct: 0.1,
    slippagePct: 0.05,
    positionSizePct: 10,
  };

  try {
    const result = runBacktest(candles, rules, params);
    assert(result.tradeCount > 0, "Backtest produce trades", `Got ${result.tradeCount} trades`);
    assert(result.finalEquity > 0, "Backtest final equity > 0", `Got ${result.finalEquity}`);
    assert(result.maxDrawdown >= 0 && result.maxDrawdown <= 1, "Max drawdown in [0,1]", `Got ${result.maxDrawdown}`);
    assert(result.sharpeRatio !== undefined, "Sharpe ratio computed", `Got ${result.sharpeRatio}`);
    assert(result.equityCurve.length > 0, "Equity curve generated", `Got ${result.equityCurve.length} points`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, "Backtest engine runs without error", msg);
  }
}

// ─── Test 2: Scorer ───────────────────────────────────────────────────────

function testScorer() {
  const mockResult = {
    trades: Array.from({ length: 40 }, (_, i) => ({
      side: i % 2 === 0 ? "long" as const : "short" as const,
      entryPrice: 50000,
      exitPrice: i % 3 === 0 ? 48000 : 52000,
      entryTime: Date.now() - 100000,
      exitTime: Date.now(),
      pnl: i % 3 === 0 ? -500 : 500,
      pnlPct: i % 3 === 0 ? -1 : 1,
      exitReason: "test",
    })),
    totalReturn: 5000,
    totalReturnPct: 50,
    maxDrawdown: 0.15,
    sharpeRatio: 1.2,
    winRate: 0.66,
    profitFactor: 2.0,
    tradeCount: 40,
    finalEquity: 15000,
    equityCurve: [{ time: Date.now(), equity: 10000 }],
  };

  const score = scoreBacktest(mockResult, false);
  assert(score.passed, "Scorer: strategy passes IS", `Score: ${score.score}, Issues: ${score.fatalIssues.join(", ")}`);
  assert(score.score > 0, "Scorer: score > 0", `Got ${score.score}`);

  // Test with bad result
  const badResult = { ...mockResult, sharpeRatio: -0.5, maxDrawdown: 0.5, winRate: 0.1, tradeCount: 3 };
  const badScore = scoreBacktest(badResult, true);
  assert(!badScore.passed, "Scorer: bad strategy fails OOS", `Score: ${badScore.score}`);
}

// ─── Test 3: Webhook validation ───────────────────────────────────────────

function testWebhookValidation() {
  // Valid payload
  const valid = validateWebhookPayload({
    ticker: "BTCUSDT",
    action: "buy",
    price: "65000",
  });
  assert(valid.schemaValid, "Webhook: valid payload accepted", `Reason: ${valid.rejectionReason}`);
  assert(valid.ticker === "BTCUSDT", "Webhook: ticker normalized to uppercase");
  assert(valid.action === "buy", "Webhook: action normalized to lowercase");

  // Missing ticker
  const noTicker = validateWebhookPayload({ action: "buy", price: "65000" });
  assert(!noTicker.schemaValid, "Webhook: missing ticker rejected");

  // Invalid action
  const badAction = validateWebhookPayload({ ticker: "BTC", action: "invalid", price: "65000" });
  assert(!badAction.schemaValid, "Webhook: invalid action rejected");

  // Missing price
  const noPrice = validateWebhookPayload({ ticker: "BTC", action: "buy" });
  assert(!noPrice.schemaValid, "Webhook: missing price rejected");

  // Token validation
  assert(validateWebhookToken("mia-chiave-segreta-cambiami"), "Webhook: correct token valid");
  assert(!validateWebhookToken("sbagliato"), "Webhook: wrong token invalid");
  assert(!validateWebhookToken(null), "Webhook: null token invalid");
}

// ─── Test 4: Duplicate detection ──────────────────────────────────────────

function testDeduplication() {
  checkDuplicate("BTC", "buy", 65000); // First call
  const dup = checkDuplicate("BTC", "buy", 65000); // Same call
  assert(dup, "Dedup: same payload detected as duplicate");

  const notDup = checkDuplicate("ETH", "sell", 3200); // Different
  assert(!notDup, "Dedup: different payload not duplicate");
}

// ─── Run all tests ────────────────────────────────────────────────────────

async function runTests() {
  console.log("🧪 A7 — Test Suite\n");

  testBacktestEngine();
  testScorer();
  testWebhookValidation();
  testDeduplication();

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  console.log(`\n📊 Risultati:`);
  for (const t of tests) {
    const icon = t.passed ? "✅" : "❌";
    console.log(`   ${icon} ${t.name}${t.error ? ` — ${t.error}` : ""}`);
  }

  console.log(`\n${passed}/${tests.length} test superati`);
  if (failed > 0) {
    console.log(`❌ ${failed} test falliti`);
    process.exit(1);
  } else {
    console.log("✅ Tutti i test superati!");
    process.exit(0);
  }
}

runTests();