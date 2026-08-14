import db, { paperTrades, strategies } from "@/db";
import { eq } from "drizzle-orm";

const open = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
const allStrats = db.select().from(strategies).all();
const now = Date.now();

// Raccogli dati per ranking
interface TradeInfo {
  id: number;
  asset: string;
  side: string;
  pnlPct: number;
  tpPct: number;
  slPct: number;
  tpDist: number;
  slDist: number;
  hoursOpen: number;
  timeLimit: number;
  timeLeft: number;
  daysOpen: number;
}

const trades: TradeInfo[] = [];

for (const t of open) {
  const strat = allStrats.find(s => s.id === t.strategyId);
  const exitRules = strat ? JSON.parse(strat.exitRulesJson || "[]") : [];
  const tpRule = exitRules.find((e: any) => e.type === "tp");
  const slRule = exitRules.find((e: any) => e.type === "sl");
  const timeRule = exitRules.find((e: any) => e.type === "time");

  const tpPct = tpRule?.params?.pct ?? 8;
  const slPct = slRule?.params?.pct ?? 4;
  const timeHours = timeRule?.params?.hours ?? 96;

  const pnlPct = t.side === "long"
    ? ((Number(t.currentPrice) - Number(t.entryPrice)) / Number(t.entryPrice) * 100)
    : ((Number(t.entryPrice) - Number(t.currentPrice)) / Number(t.entryPrice) * 100);

  const hoursOpen = (now - new Date(t.openedAt).getTime()) / (1000 * 60 * 60);
  const timeLeft = timeHours - hoursOpen;

  trades.push({
    id: t.id,
    asset: t.asset,
    side: t.side,
    pnlPct,
    tpPct,
    slPct,
    tpDist: tpPct - pnlPct,
    slDist: pnlPct + slPct,
    hoursOpen,
    timeLimit: timeHours,
    timeLeft,
    daysOpen: hoursOpen / 24,
  });
}

// Ordina per distanza dal TP (più vicino prima)
trades.sort((a, b) => a.tpDist - b.tpDist);

console.log("=== PIÙ VICINE A CHIUSURA (per TP) ===\n");
for (const t of trades) {
  const tpProgress = ((t.pnlPct / t.tpPct) * 100).toFixed(0);
  const tpBar = "█".repeat(Math.floor(Number(tpProgress) / 10)) + "░".repeat(10 - Math.floor(Number(tpProgress) / 10));
  const timeBar = t.timeLeft > 0
    ? ((t.hoursOpen / t.timeLimit) * 100).toFixed(0) + "%"
    : "SCADUTA!";

  console.log(`#${t.id} ${t.asset} ${t.side} | ${t.pnlPct.toFixed(2)}% / ${t.tpPct}% TP`);
  console.log(`   ${tpBar} ${tpProgress}% del TP`);
  console.log(`   Mancano ${t.tpDist.toFixed(2)}% al TP | Margine SL: ${t.slDist.toFixed(2)}%`);
  console.log(`   Aperto da ${t.daysOpen.toFixed(1)}g (${t.hoursOpen.toFixed(0)}h/${t.timeLimit}h) — ${timeBar}`);
  console.log("");
}

console.log("=== ANALISI DI MERCATO ===");
console.log("BTC è a $65,312 — ha appena superato la resistenza chiave a $65,150");
console.log("ETH a $1,958 — balzo del 3.8% in 20 minuti");
console.log("");

// Fonte: analisi bitcoinfoundation.org
console.log("FONTI: Bitcoin Foundation — BTC in zona decisionale");
console.log("- Resistenza: $65,150 (APPENA SUPERATA)");
console.log("- Prossimi target: $66,000-$68,000");
console.log("- Se perde $58,300 → scenario ribassista verso $56,000");
console.log("- Trend generale: BTC sotto EMA50 ($65,143) e 200EMA ($74,705) — contesto ribassista di lungo");
console.log("- ETH segue BTC, volatilità amplificata");
console.log("");

console.log("=== VALUTAZIONE RISCHIO ===");
console.log("POSITIVO: BTC ha appena superato $65,150 (resistenza chiave). Se chiude sopra,");
console.log("  apre spazio verso $66-68K. ETH ha spazio fino a $2,000+.");
console.log("RISCHIO: Siamo in un contesto di lungo bearish (BTC -44% annuo).");
console.log("  Il rally di oggi potrebbe essere un rimbalzo tecnico in un downtrend.");
console.log("  Se BTC non tiene sopra $65K, si torna verso $63K e le posizioni si erodono.");
console.log("");

// Ranking rischio
console.log("=== RANKING RISCHIO (più a rischio prima) ===");
const riskSorted = [...trades].sort((a, b) => {
  // Più a rischio: pnl più basso, distanza SL minore
  return a.slDist - b.slDist;
});
for (const t of riskSorted) {
  const risk = t.slDist < 2 ? "🔴 ALTO" : t.slDist < 4 ? "🟡 MEDIO" : "🟢 BASSO";
  console.log(`#${t.id} ${t.asset} | ${risk} | PnL ${t.pnlPct.toFixed(2)}% | SL margine ${t.slDist.toFixed(2)}%`);
}