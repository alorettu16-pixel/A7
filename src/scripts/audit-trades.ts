import db, { paperTrades, strategies, riskLimits } from "@/db";
import { eq } from "drizzle-orm";

const open = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
console.log("=== POSIZIONI APERTE (DB RAW) ===");
for (const t of open) {
  const strat = db.select().from(strategies).where(eq(strategies.id, t.strategyId)).get();
  const pnlPct = t.side === "long"
    ? ((Number(t.currentPrice) - Number(t.entryPrice)) / Number(t.entryPrice) * 100).toFixed(2)
    : ((Number(t.entryPrice) - Number(t.currentPrice)) / Number(t.entryPrice) * 100).toFixed(2);
  console.log("#" + t.id + " | " + t.asset + " " + t.side + " | entry=" + t.entryPrice + " curr=" + t.currentPrice + " | PnL%=" + pnlPct + "% | size=" + t.simulatedPositionSize + "$ | stratId=" + t.strategyId + " | opened=" + (t.openedAt || "").slice(0, 19));
}

console.log("");
console.log("=== INTEGRIT\u00C0 ===");
const nullFields = open.filter(t => !t.entryPrice || !t.currentPrice || t.simulatedPositionSize === null || t.side === null);
console.log("Campi null: " + nullFields.length);
const negSize = open.filter(t => (t.simulatedPositionSize || 0) <= 0);
console.log("Size <= 0: " + negSize.length);
const pairs = open.map(t => t.asset + "-" + t.strategyId);
const dups: string[] = [];
const seen: Record<string, boolean> = {};
for (const p of pairs) { if (seen[p]) dups.push(p); seen[p] = true; }
console.log("Duplicati asset+strategy: " + (dups.length > 0 ? dups.join(", ") : "nessuno"));

const limits = db.select().from(riskLimits).limit(1).all();
if (limits[0]) {
  console.log("");
  console.log("=== RISK LIMITS ===");
  console.log("maxExposure: " + limits[0].maxTotalExposureUsd + "$");
  console.log("maxPosition: " + limits[0].maxPositionSizeUsd + "$");
  console.log("maxDrawdown: " + limits[0].maxDailyDrawdownPct + "%");
  console.log("killSwitch: " + (limits[0].killSwitchActive ? "\u26A0\uFE0F ATTIVO" : "\u2705 spento"));
  console.log("liveTrading: " + (limits[0].liveTradingEnabled ? "\u2705" : "\u274C"));
}

const closed = db.select().from(paperTrades).where(eq(paperTrades.status, "closed")).all();
console.log("");
console.log("=== TRADES CHIUSI ===");
console.log("Totale chiusi: " + closed.length);
for (const t of closed) {
  const pnl = t.realizedPnl || 0;
  console.log("#" + t.id + " " + t.asset + " " + t.side + " | entry=" + t.entryPrice + " exit=" + t.currentPrice + " | PnL=" + pnl.toFixed(2) + "$ | " + (pnl > 0 ? "\u2705" : "\u274C"));
}

const totalRealized = closed.reduce((s, t) => s + (t.realizedPnl || 0), 0);
const totalUnrealized = open.reduce((s, t) => s + (t.unrealizedPnl || 0), 0);
const totalExposure = open.reduce((s, t) => s + (t.simulatedPositionSize || 0), 0);
console.log("");
console.log("=== SOMMARIO ===");
console.log("Realizzato: " + totalRealized.toFixed(2) + "$");
console.log("Non realizzato: " + totalUnrealized.toFixed(2) + "$");
console.log("Totale: " + (totalRealized + totalUnrealized).toFixed(2) + "$");
console.log("Esposizione: " + totalExposure.toFixed(2) + "$");