import Database from "better-sqlite3";
import * as path from "path";

const db = new Database(path.join(process.cwd(), "a7.db"));

console.log("=== TOP 10 STRATEGIE (media PnL IS+OOS) ===\n");

const top = db.prepare(`
  SELECT s.id, s.name,
    ROUND(AVG(br.total_return), 1) as avg_pnl,
    ROUND(AVG(br.win_rate) * 100, 1) as avg_win_rate,
    ROUND(AVG(br.trade_count), 0) as avg_trades,
    ROUND(AVG(br.sharpe_ratio), 2) as avg_sharpe,
    COUNT(*) as runs,
    SUM(CASE WHEN br.passed = 1 THEN 1 ELSE 0 END) as passed
  FROM backtest_runs br
  JOIN strategies s ON s.id = br.strategy_id
  GROUP BY s.id
  ORDER BY avg_pnl DESC
  LIMIT 10
`).all() as any[];

console.log("Rank | Nome                              | MediaPnL | WinRate | Trades | Sharpe | Passati");
console.log("-".repeat(95));
(top as any[]).forEach((r: any, i: number) => {
  console.log(
    " " + String(i+1).padStart(2) + "  | " + r.name.padEnd(34) +
    " | " + String(r.avg_pnl).padStart(7) + "$" +
    " | " + String(r.avg_win_rate).padStart(5) + "%" +
    " | " + String(r.avg_trades).padStart(5) +
    " | " + String(r.avg_sharpe).padStart(5) +
    " | " + String(r.passed).padStart(3) + "/" + r.runs
  );
});

console.log("\n=== PEGGIORI 5 STRATEGIE (media PnL) ===");
const worst = db.prepare(`
  SELECT s.name,
    ROUND(AVG(br.total_return), 1) as avg_pnl,
    ROUND(AVG(br.win_rate) * 100, 1) as avg_win_rate,
    COUNT(*) as runs
  FROM backtest_runs br
  JOIN strategies s ON s.id = br.strategy_id
  GROUP BY s.id
  ORDER BY avg_pnl ASC
  LIMIT 5
`).all() as any[];

(worst as any[]).forEach((r: any, i: number) => {
  console.log(" " + String(i+1) + ". " + r.name.padEnd(35) + " PnL: " + r.avg_pnl + "$  Win: " + r.avg_win_rate + "%  Runs: " + r.runs);
});

console.log("\n=== TOP ASSET (media PnL) ===");
const assets = db.prepare(`
  SELECT asset,
    ROUND(AVG(total_return), 1) as avg_pnl,
    ROUND(AVG(win_rate) * 100, 1) as avg_wr,
    ROUND(AVG(trade_count), 0) as avg_tr,
    COUNT(*) as runs,
    SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed
  FROM backtest_runs
  GROUP BY asset
  ORDER BY avg_pnl DESC
`).all() as any[];
(assets as any[]).forEach((a: any) => {
  console.log(" " + a.asset.padEnd(6) + " PnL: " + a.avg_pnl + "$  WR: " + a.avg_wr + "%  Trades: " + a.avg_tr + "  Runs: " + a.runs + "  Pass: " + a.passed);
});

console.log("\n=== TIMEFRAME (media PnL) ===");
const tfs = db.prepare(`
  SELECT timeframe,
    ROUND(AVG(total_return), 1) as avg_pnl,
    ROUND(AVG(win_rate) * 100, 1) as avg_wr,
    ROUND(AVG(trade_count), 0) as avg_tr,
    SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed,
    COUNT(*) as runs
  FROM backtest_runs
  GROUP BY timeframe
  ORDER BY avg_pnl DESC
`).all() as any[];
(tfs as any[]).forEach((t: any) => {
  console.log(" " + t.timeframe + "   PnL: " + t.avg_pnl + "$  WR: " + t.avg_wr + "%  Trades: " + t.avg_tr + "  Pass: " + t.passed + "/" + t.runs);
});