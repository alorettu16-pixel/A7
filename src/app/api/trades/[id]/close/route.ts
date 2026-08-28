import db, { paperTrades, strategies, decisionJournal, pnlSnapshots } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { closePaperTrade } from "@/paper-trading/engine";
import { sendTelegram, formatTradeClose } from "@/lib/telegram";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tradeId = parseInt(id, 10);
  if (isNaN(tradeId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  const trade = db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.id, tradeId))
    .limit(1)
    .get();

  if (!trade) {
    return NextResponse.json({ error: "Trade non trovato" }, { status: 404 });
  }

  if (trade.status !== "open") {
    return NextResponse.json({ error: "Trade già chiuso" }, { status: 400 });
  }

  const exitPrice = trade.currentPrice;
  await closePaperTrade(tradeId, exitPrice);

  // Notifica Telegram
  const closedTrade = db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.id, tradeId))
    .limit(1)
    .get();

  if (closedTrade) {
    let strategyName = "?";
    const strat = db
      .select()
      .from(strategies)
      .where(eq(strategies.id, closedTrade.strategyId))
      .limit(1)
      .get();
    if (strat) strategyName = strat.name;

    await sendTelegram(
      formatTradeClose(
        tradeId,
        closedTrade.asset,
        closedTrade.side as "long" | "short",
        closedTrade.entryPrice,
        exitPrice,
        closedTrade.realizedPnl || 0,
        "manual_close",
        strategyName,
      ),
    );
  }

  return NextResponse.json({ success: true, exitPrice });
}