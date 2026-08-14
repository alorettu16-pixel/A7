import { generateDailyReport } from "@/report/generator";

async function main() {
  console.log("📰 Generazione report giornaliero...");
  const report = await generateDailyReport();
  console.log(`\n📊 Report ${report.date}`);
  console.log(`   PnL paper: ${report.paperPnl}$`);
  console.log(`   Win rate: ${report.winRate}%`);
  console.log(`   Posizioni aperte: ${report.openPositions}`);
  console.log(`   Segnali oggi: ${report.newSignals}`);
  console.log(`   Segnali TradingView: ${report.tradingViewSignalsToday}`);
  console.log(`   Strategie attive: ${report.activeStrategies}`);
  console.log(`   Live trading: ${report.liveTradingStatus ? "✅ ATTIVO" : "⛔ DISABILITATO"}`);
  console.log(`\n   ${report.summary}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});