import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "a7.db");
const sqlite = new Database(dbPath);

console.log("🧹 Azzeramento completo...");

sqlite.pragma("foreign_keys = OFF");

sqlite.exec("DELETE FROM pnl_snapshots");            console.log(" ✅ pnl_snapshots");
sqlite.exec("DELETE FROM strategy_signals");         console.log(" ✅ strategy_signals");
sqlite.exec("DELETE FROM outcome_reviews");          console.log(" ✅ outcome_reviews");
sqlite.exec("DELETE FROM decision_journal");         console.log(" ✅ decision_journal");
sqlite.exec("DELETE FROM paper_trades");             console.log(" ✅ paper_trades");
sqlite.exec("DELETE FROM backtest_trades");          console.log(" ✅ backtest_trades");
sqlite.exec("DELETE FROM backtest_runs");            console.log(" ✅ backtest_runs");
sqlite.exec("DELETE FROM rule_changes");             console.log(" ✅ rule_changes");
sqlite.exec("DELETE FROM rule_sets");                console.log(" ✅ rule_sets");

sqlite.exec("DELETE FROM sqlite_sequence");
sqlite.pragma("foreign_keys = ON");

console.log("\n✅ Tutti i dati di trading azzerati. Sistema pronto per ripartire.");

const count = sqlite.prepare("SELECT COUNT(*) as c FROM paper_trades").get() as any;
console.log(`📊 Paper trades: ${count.c}`);

sqlite.close();