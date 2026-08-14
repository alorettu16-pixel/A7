import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── STRATEGIES ─────────────────────────────────────────────────────────────

export const strategies = sqliteTable("strategies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  source: text("source", {
    enum: ["web_research", "builder", "tradingview_webhook"],
  }).notNull().default("web_research"),
  category: text("category", {
    enum: ["trend_following", "mean_reversion", "breakout", "momentum", "grid", "custom"],
  }).notNull(),
  sourceDescription: text("source_description").notNull(),
  entryRulesJson: text("entry_rules_json").notNull(),
  exitRulesJson: text("exit_rules_json").notNull(),
  parametersJson: text("parameters_json").notNull(),
  pineScriptRef: text("pine_script_ref"),
  status: text("status", {
    enum: ["research", "backtesting", "paper_active", "watch", "rejected", "live_eligible"],
  }).notNull().default("research"),
  statusReason: text("status_reason"),
  sourceUrl: text("source_url"),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

// ─── STRATEGY VERSIONS ──────────────────────────────────────────────────────

export const strategyVersions = sqliteTable("strategy_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  version: integer("version").notNull(),
  parametersJson: text("parameters_json").notNull(),
  reason: text("reason"),
  evidenceSummary: text("evidence_summary"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── MARKET DATA CACHE ──────────────────────────────────────────────────────

export const marketDataCache = sqliteTable("market_data_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  asset: text("asset").notNull(),
  exchange: text("exchange").notNull(),
  timeframe: text("timeframe").notNull(),
  candlesJson: text("candles_json").notNull(),
  rangeStart: text("range_start").notNull(),
  rangeEnd: text("range_end").notNull(),
  fetchedAt: text("fetched_at").notNull().default(sql`(current_timestamp)`),
});

// ─── BACKTEST RUNS ──────────────────────────────────────────────────────────

export const backtestRuns = sqliteTable("backtest_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  asset: text("asset").notNull(),
  timeframe: text("timeframe").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  isOutOfSample: integer("is_out_of_sample", { mode: "boolean" }).notNull().default(false),
  sharpeRatio: real("sharpe_ratio"),
  maxDrawdown: real("max_drawdown"),
  winRate: real("win_rate"),
  profitFactor: real("profit_factor"),
  tradeCount: integer("trade_count"),
  totalReturn: real("total_return"),
  passed: integer("passed", { mode: "boolean" }),
  rawResultsJson: text("raw_results_json"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── BACKTEST TRADES ────────────────────────────────────────────────────────

export const backtestTrades = sqliteTable("backtest_trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  backtestRunId: integer("backtest_run_id").notNull().references(() => backtestRuns.id),
  side: text("side", { enum: ["long", "short"] }).notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  entryTime: text("entry_time").notNull(),
  exitTime: text("exit_time"),
  pnl: real("pnl"),
  exitReason: text("exit_reason"),
});

// ─── TRADINGVIEW WEBHOOK LOG ────────────────────────────────────────────────

export const tradingViewWebhookLogs = sqliteTable("tradingview_webhook_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receivedAt: text("received_at").notNull().default(sql`(current_timestamp)`),
  rawPayload: text("raw_payload").notNull(),
  tokenValid: integer("token_valid", { mode: "boolean" }).notNull().default(false),
  schemaValid: integer("schema_valid", { mode: "boolean" }).notNull().default(false),
  isDuplicate: integer("is_duplicate", { mode: "boolean" }).notNull().default(false),
  ticker: text("ticker"),
  action: text("action"),
  price: real("price"),
  linkedStrategySignalId: integer("linked_strategy_signal_id"),
  rejectionReason: text("rejection_reason"),
});

// ─── STRATEGY SIGNALS ───────────────────────────────────────────────────────

export const strategySignals = sqliteTable("strategy_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  asset: text("asset").notNull(),
  side: text("side", { enum: ["long", "short"] }).notNull(),
  signalPrice: real("signal_price").notNull(),
  timestamp: text("timestamp").notNull(),
  origin: text("origin", { enum: ["internal", "tradingview_webhook"] }).notNull().default("internal"),
  rawDataJson: text("raw_data_json"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── DECISION JOURNAL ───────────────────────────────────────────────────────

export const decisionJournal = sqliteTable("decision_journal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategySignalId: integer("strategy_signal_id").references(() => strategySignals.id),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  decision: text("decision", {
    enum: ["paper_copy", "watchlist", "skip", "live_execute"],
  }).notNull(),
  confidenceScore: real("confidence_score"),
  reasonsJson: text("reasons_json"),
  risksJson: text("risks_json"),
  simulatedPositionSize: real("simulated_position_size"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── PAPER TRADES ───────────────────────────────────────────────────────────

export const paperTrades = sqliteTable("paper_trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  decisionJournalId: integer("decision_journal_id").references(() => decisionJournal.id),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  asset: text("asset").notNull(),
  side: text("side", { enum: ["long", "short"] }).notNull(),
  entryPrice: real("entry_price").notNull(),
  currentPrice: real("current_price").notNull(),
  simulatedPositionSize: real("simulated_position_size").notNull(),
  feesApplied: real("fees_applied").default(0),
  slippageApplied: real("slippage_applied").default(0),
  unrealizedPnl: real("unrealized_pnl").default(0),
  realizedPnl: real("realized_pnl").default(0),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  openedAt: text("opened_at").notNull().default(sql`(current_timestamp)`),
  closedAt: text("closed_at"),
});

// ─── PNL SNAPSHOTS ──────────────────────────────────────────────────────────

export const pnlSnapshots = sqliteTable("pnl_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paperTradeId: integer("paper_trade_id").notNull().references(() => paperTrades.id),
  price: real("price").notNull(),
  pnl: real("pnl").notNull(),
  collectedAt: text("collected_at").notNull().default(sql`(current_timestamp)`),
});

// ─── OUTCOME REVIEWS ────────────────────────────────────────────────────────

export const outcomeReviews = sqliteTable("outcome_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  decisionJournalId: integer("decision_journal_id").references(() => decisionJournal.id),
  paperTradeId: integer("paper_trade_id").references(() => paperTrades.id),
  reviewTime: text("review_time").notNull().default(sql`(current_timestamp)`),
  finalOutcome: text("final_outcome", { enum: ["win", "loss", "breakeven"] }),
  simulatedPnl: real("simulated_pnl"),
  wasDecisionGood: integer("was_decision_good", { mode: "boolean" }),
  deviationFromBacktest: real("deviation_from_backtest"),
  lessonsJson: text("lessons_json"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── RULE SETS & CHANGES ────────────────────────────────────────────────────

export const ruleSets = sqliteTable("rule_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  version: integer("version").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  rulesJson: text("rules_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export const ruleChanges = sqliteTable("rule_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  oldRuleSetId: integer("old_rule_set_id").references(() => ruleSets.id),
  newRuleSetId: integer("new_rule_set_id").references(() => ruleSets.id),
  changedBy: text("changed_by", { enum: ["hermes", "manual"] }).notNull(),
  reason: text("reason"),
  evidenceSummary: text("evidence_summary"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── RISK LIMITS ────────────────────────────────────────────────────────────

export const riskLimits = sqliteTable("risk_limits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  liveTradingEnabled: integer("live_trading_enabled", { mode: "boolean" }).notNull().default(false),
  maxDailyDrawdownPct: real("max_daily_drawdown_pct").notNull().default(10),
  maxPositionSizeUsd: real("max_position_size_usd").notNull().default(100),
  maxTotalExposureUsd: real("max_total_exposure_usd").notNull().default(500),
  maxLeverageAllowed: real("max_leverage_allowed").notNull().default(1),
  allowedStrategiesJson: text("allowed_strategies_json").notNull().default("[]"),
  allowedBrokersJson: text("allowed_brokers_json").notNull().default("[]"),
  demoBudgetUsd: real("demo_budget_usd").notNull().default(10000),
  killSwitchActive: integer("kill_switch_active", { mode: "boolean" }).notNull().default(false),
  lastModifiedBy: text("last_modified_by").notNull().default("manual"),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

// ─── BROKER CONNECTIONS ─────────────────────────────────────────────────────

export const brokerConnections = sqliteTable("broker_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  broker: text("broker", { enum: ["bitget", "binance", "other"] }).notNull(),
  status: text("status", { enum: ["disconnected", "connected", "error"] }).notNull().default("disconnected"),
  permissionsVerified: integer("permissions_verified", { mode: "boolean" }).notNull().default(false),
  lastHealthCheckAt: text("last_health_check_at"),
  lastHealthCheckResult: text("last_health_check_result"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── LIVE TRADE LOG ─────────────────────────────────────────────────────────

export const liveTradeLogs = sqliteTable("live_trade_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: integer("strategy_id").notNull().references(() => strategies.id),
  brokerConnectionId: integer("broker_connection_id").references(() => brokerConnections.id),
  asset: text("asset").notNull(),
  side: text("side", { enum: ["long", "short"] }).notNull(),
  entryPrice: real("entry_price"),
  exitPrice: real("exit_price"),
  positionSize: real("position_size"),
  realizedPnl: real("realized_pnl"),
  executedAt: text("executed_at").notNull().default(sql`(current_timestamp)`),
  exchangeOrderId: text("exchange_order_id"),
});

// ─── DAILY REPORTS ──────────────────────────────────────────────────────────

export const dailyReports = sqliteTable("daily_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  paperPnl: real("paper_pnl"),
  winRate: real("win_rate"),
  openPositions: integer("open_positions"),
  newSignals: integer("new_signals"),
  tradingViewSignalsToday: integer("tradingview_signals_today").default(0),
  activeStrategies: integer("active_strategies"),
  rejectedStrategies: integer("rejected_strategies"),
  ruleChangesJson: text("rule_changes_json"),
  deviationAlertsJson: text("deviation_alerts_json"),
  liveTradingStatus: integer("live_trading_status", { mode: "boolean" }).default(false),
  summary: text("summary"),
  sentToTelegram: integer("sent_to_telegram", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ─── EQUITY SNAPSHOTS ───────────────────────────────────────────────────────

export const equitySnapshots = sqliteTable("equity_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalPnl: real("total_pnl").notNull(),
  realizedPnl: real("realized_pnl").notNull(),
  unrealizedPnl: real("unrealized_pnl").notNull(),
  openCount: integer("open_count").notNull().default(0),
  closedCount: integer("closed_count").notNull().default(0),
  snapshotAt: text("snapshot_at").notNull().default(sql`(current_timestamp)`),
});