import db from "../db";
import { strategies, strategySignals, decisionJournal, paperTrades } from "../db/schema";
import { eq } from "drizzle-orm";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE"];

async function main() {
  const active = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
  if (active.length === 0) {
    console.log("Nessuna strategia attiva.");
    process.exit(0);
  }

  let count = 0;
  const usedStrategies = new Set<number>();

  // Genera 10 segnali con strategie e asset diversi, PnL positivo
  for (let i = 0; i < 10; i++) {
    // Scegli una strategia diversa ogni volta
    let strat: any;
    let attempts = 0;
    do {
      strat = active[Math.floor(Math.random() * active.length)];
      attempts++;
    } while (usedStrategies.has(strat.id) && attempts < 30);
    usedStrategies.add(strat.id);

    const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
    const side = Math.random() > 0.4 ? "long" : "short";
    const basePrice = asset === "BTC" ? 64000 + Math.random() * 2000 :
                      asset === "ETH" ? 1850 + Math.random() * 50 :
                      asset === "SOL" ? 75 + Math.random() * 5 :
                      asset === "BNB" ? 560 + Math.random() * 20 :
                      asset === "XRP" ? 1.08 + Math.random() * 0.05 :
                      asset === "ADA" ? 0.16 + Math.random() * 0.02 :
                      asset === "DOGE" ? 0.07 + Math.random() * 0.01 : 100;

    const entryPrice = basePrice;
    // PnL positivo: currentPrice > entryPrice per long, < per short
    const pnlDirection = side === "long" ? 1 : -1;
    const pnlPct = (0.5 + Math.random() * 1.5) / 100; // 0.5% - 2% profitto
    const currentPrice = side === "long"
      ? entryPrice * (1 + pnlPct)
      : entryPrice * (1 - pnlPct);
    const unrealizedPnl = side === "long"
      ? (currentPrice - entryPrice) / entryPrice * 100
      : (entryPrice - currentPrice) / entryPrice * 100;

    // Signal
    const sig = db.insert(strategySignals).values({
      strategyId: strat.id,
      asset,
      side,
      signalPrice: entryPrice,
      timestamp: new Date(Date.now() - i * 60000 * 30).toISOString(), // ogni 30 minuti indietro
      origin: "internal",
      rawDataJson: JSON.stringify({ demo: true, reason: "Segnale demo positivo" }),
    }).run();

    // Decision
    const dec = db.insert(decisionJournal).values({
      strategySignalId: Number(sig.lastInsertRowid),
      strategyId: strat.id,
      decision: "paper_copy",
      confidenceScore: 0.7 + Math.random() * 0.25,
      reasonsJson: JSON.stringify(["Segnale demo — simulazione profitto"]),
      risksJson: JSON.stringify(["Rischio standard di mercato"]),
      simulatedPositionSize: 100,
    }).run();

    // Paper trade — metà aperti, metà chiusi con profitto
    const isOpen = i < 5;
    if (isOpen) {
      db.insert(paperTrades).values({
        decisionJournalId: Number(dec.lastInsertRowid),
        strategyId: strat.id,
        asset,
        side,
        entryPrice,
        currentPrice,
        simulatedPositionSize: 100,
        feesApplied: 0.1,
        slippageApplied: 0.05,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        status: "open",
        openedAt: new Date(Date.now() - i * 60000 * 30).toISOString(),
      }).run();
      console.log(`   📈 ${asset} ${side.toUpperCase()} #${strat.id} ${strat.name}: +${unrealizedPnl.toFixed(2)}% aperto`);
    } else {
      // Chiuso con profitto
      const realizedPnl = unrealizedPnl - 0.2; // -0.2$ di fee
      db.insert(paperTrades).values({
        decisionJournalId: Number(dec.lastInsertRowid),
        strategyId: strat.id,
        asset,
        side,
        entryPrice,
        currentPrice,
        simulatedPositionSize: 100,
        feesApplied: 0.1,
        slippageApplied: 0.05,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        unrealizedPnl: 0,
        status: "closed",
        openedAt: new Date(Date.now() - i * 60000 * 60).toISOString(),
        closedAt: new Date(Date.now() - i * 60000 * 30).toISOString(),
      }).run();
      console.log(`   🔒 ${asset} ${side.toUpperCase()} #${strat.id} ${strat.name}: +${realizedPnl.toFixed(2)}$ chiuso`);
    }

    count++;
  }

  console.log(`\n✅ ${count} segnali demo positivi generati (5 aperti, 5 chiusi in profitto).`);
  console.log("   Ricarica la dashboard su http://localhost:3001");
  process.exit(0);
}

main().catch(console.error);