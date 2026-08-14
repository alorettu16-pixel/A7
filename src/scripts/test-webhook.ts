// Test webhook locally — simulates a TradingView alert POST
// Usage: tsx src/scripts/test-webhook.ts

async function main() {
  const webhookUrl = process.env.WEBHOOK_URL || "http://localhost:3001/api/webhooks/tradingview";
  const token = process.env.TRADINGVIEW_WEBHOOK_SECRET || "mia-chiave-segreta-cambiami";

  const payload = {
    ticker: "BTCUSDT",
    action: "buy",
    price: "65432.50",
    exchange: "BYBIT",
    strategy_name: "MyPineStrategy",
    pine_id: "abc123",
  };

  console.log(`📡 Invio webhook test a ${webhookUrl}...`);
  console.log(`   Token: ${token.slice(0, 4)}...${token.slice(-4)}`);
  console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

  try {
    const res = await fetch(`${webhookUrl}?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`\n✅ Risposta (${res.status}):`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`\n❌ Errore connessione:`, err);
    console.log("\nAssicurati che il server sia in esecuzione (npm run dev)");
  }

  process.exit(0);
}

main();