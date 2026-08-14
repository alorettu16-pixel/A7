import Database from "better-sqlite3";
import * as path from "path";

const db = new Database(path.join(process.cwd(), "a7.db"));

console.log("=== A7 — Report Performance ===\n");
console.log("Data: " + new Date().toLocaleDateString("it-IT") + "\n");

// 1. Panoramica paper trading
const totalTrades = db.prepare("SELECT COUNT(*) as c, SUM(realized_pnl) as pnl, SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as wins FROM paper_trades WHERE status = 'closed'").get() as any;
const openTrades = db.prepare("SELECT COUNT(*) as c, SUM(unrealized_pnl) as pnl FROM paper_trades WHERE status = 'open'").get() as any;
const limits = db.prepare("SELECT demo_budget_usd FROM risk_limits LIMIT 1").get() as any;
const budget = limits?.demo_budget_usd || 500;
const winRate = totalTrades.c > 0 ? (totalTrades.wins / totalTrades.c * 100) : 0;

console.log("PAPER TRADING");
console.log("  Budget: $" + budget);
console.log("  Trade chiusi: " + totalTrades.c);
console.log("  Trade aperti: " + openTrades.c);
console.log("  PnL: " + (totalTrades.pnl || 0).toFixed(2) + "$ (realizzato) / " + (openTrades.pnl || 0).toFixed(2) + "$ (non realizzato)");
console.log("  Win Rate: " + winRate.toFixed(1) + "%");
console.log("");

// 2. Backtest — migliori risultati per strategia
console.log("BACKTEST RISULTATI (miglior combinazione per strategia)");
console.log("");

const btResults = db.prepare(`
  SELECT 
    s.name,
    s.category,
    br.asset,
    br.timeframe,
    br.sharpe_ratio,
    br.max_drawdown,
    br.win_rate,
    br.trade_count,
    br.total_return,
    br.passed,
    br.is_out_of_sample
  FROM backtest_runs br
  JOIN strategies s ON s.id = br.strategy_id
  WHERE br.is_out_of_sample = 0
  ORDER BY br.total_return DESC
  LIMIT 30
`).all() as any[];

console.log("  # | Nome Strategia                  | Asset | TF  | Trade | Win%  | PnL      | Sharpe");
console.log("  " + "-".repeat(80));
btResults.forEach((r: any, i: number) => {
  console.log("  " + String(i+1).padStart(2) + " | " + r.name.slice(0, 32).padEnd(32) + " | " + r.asset.padEnd(5) + " | " + r.timeframe.padEnd(3) + " | " + String(r.trade_count).padStart(4) + " | " + (r.win_rate * 100).toFixed(0).padStart(3) + "% | " + (r.total_return || 0).toFixed(0).padStart(7) + "$ | " + (r.sharpe_ratio || 0).toFixed(2));
});

// 3. Asset performance
console.log("\nPERFORMANCE PER ASSET (backtest)");
const assetPerf = db.prepare(`
  SELECT asset, COUNT(*) as runs, AVG(total_return) as avg_return, AVG(win_rate) as avg_wr, AVG(trade_count) as avg_trades
  FROM backtest_runs WHERE is_out_of_sample = 0
  GROUP BY asset ORDER BY avg_return DESC
`).all() as any[];

assetPerf.forEach((a: any) => {
  console.log("  " + a.asset.padEnd(6) + " | " + String(a.runs).padStart(3) + " run | media " + (a.avg_return || 0).toFixed(0) + "$ | " + (a.avg_wr * 100).toFixed(0) + "% win | " + (a.avg_trades || 0).toFixed(0) + " trade");
});

console.log("\n---");
console.log("Log: logs/a7.log");