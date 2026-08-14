import db from "../db";
import { paperTrades } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { closePaperTrade } from "../paper-trading/engine";

async function main() {
  const btcOpen = db.select().from(paperTrades).where(
    and(eq(paperTrades.asset, "BTC"), eq(paperTrades.status, "open"))
  ).orderBy(paperTrades.id).all();

  console.log(`Posizioni BTC aperte: ${btcOpen.length}`);
  let closed = 0;

  for (let i = 2; i < btcOpen.length; i++) {
    const t = btcOpen[i];
    await closePaperTrade(t.id, t.currentPrice);
    console.log(`  🔒 #${t.id} BTC chiuso @ ${t.currentPrice}`);
    closed++;
  }

  const ethOpen = db.select().from(paperTrades).where(
    and(eq(paperTrades.asset, "ETH"), eq(paperTrades.status, "open"))
  ).orderBy(paperTrades.id).all();

  console.log(`\nPosizioni ETH aperte: ${ethOpen.length}`);
  for (let i = 2; i < ethOpen.length; i++) {
    const t = ethOpen[i];
    await closePaperTrade(t.id, t.currentPrice);
    console.log(`  🔒 #${t.id} ETH chiuso @ ${t.currentPrice}`);
    closed++;
  }

  console.log(`\n✅ Totale chiuse: ${closed}`);

  const remaining = db.select().from(paperTrades).where(eq(paperTrades.status, "open")).all();
  console.log(`\n📊 Posizioni aperte rimanenti: ${remaining.length}`);
  for (const t of remaining) {
    console.log(`   #${t.id} ${t.asset} ${t.side} @ ${t.entryPrice} size: ${t.simulatedPositionSize}$`);
  }
}

main().catch(console.error);