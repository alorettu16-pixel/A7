import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbPath = process.env.DATABASE_URL?.replace("file:", "") || path.join(process.cwd(), "a7.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

export default db;

// Re-export all schema tables for convenience
export const {
  strategies,
  strategyVersions,
  marketDataCache,
  backtestRuns,
  backtestTrades,
  tradingViewWebhookLogs,
  strategySignals,
  decisionJournal,
  paperTrades,
  pnlSnapshots,
  outcomeReviews,
  ruleSets,
  ruleChanges,
  riskLimits,
  brokerConnections,
  liveTradeLogs,
  dailyReports,
  equitySnapshots,
} = schema;