import { NextRequest, NextResponse } from "next/server";
import db, { tradingViewWebhookLogs, strategySignals, decisionJournal, strategies } from "@/db";
import { eq, and } from "drizzle-orm";
import { validateWebhookToken, validateWebhookPayload, checkDuplicate, DEDUP_WINDOW_MS } from "@/webhook/validator";
import { TradingViewWebhookPayload } from "@/webhook/validator";
import { openPaperTrade } from "@/paper-trading/engine";

// TradingView webhook endpoint
// POST /api/webhooks/tradingview?token=<secret>
// Payload: { "ticker": "BTCUSDT", "action": "buy", "price": "65000", "exchange": "BYBIT", "strategy_name": "..." }

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Get token from query param or header
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-webhook-token");

  // 2. Validate token
  if (!token || !validateWebhookToken(token)) {
    // Log the attempt even if token is invalid
    const rawBody = await request.text().catch(() => "{}");
    await db.insert(tradingViewWebhookLogs).values({
      rawPayload: rawBody,
      tokenValid: false,
      schemaValid: false,
      isDuplicate: false,
      rejectionReason: "Token non valido",
    });

    return NextResponse.json(
      { error: "Token non valido", status: "rejected" },
      { status: 401 }
    );
  }

  // 3. Parse body
  let body: unknown;
  let rawBody = "";
  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody);
  } catch {
    await db.insert(tradingViewWebhookLogs).values({
      rawPayload: rawBody || "{}",
      tokenValid: true,
      schemaValid: false,
      isDuplicate: false,
      rejectionReason: "Payload JSON non valido",
    });
    return NextResponse.json(
      { error: "Payload JSON non valido", status: "rejected" },
      { status: 400 }
    );
  }

  // 4. Validate payload schema
  const validation = validateWebhookPayload(body);
  if (!validation.schemaValid) {
    await db.insert(tradingViewWebhookLogs).values({
      rawPayload: rawBody,
      tokenValid: true,
      schemaValid: false,
      isDuplicate: false,
      ticker: validation.ticker,
      action: validation.action,
      price: validation.price,
      rejectionReason: validation.rejectionReason,
    });
    return NextResponse.json(
      { error: validation.rejectionReason, status: "rejected" },
      { status: 400 }
    );
  }

  // 5. Check for duplicates
  const isDuplicate = checkDuplicate(
    validation.ticker!,
    validation.action!,
    validation.price!
  );

  if (isDuplicate) {
    await db.insert(tradingViewWebhookLogs).values({
      rawPayload: rawBody,
      tokenValid: true,
      schemaValid: true,
      isDuplicate: true,
      ticker: validation.ticker,
      action: validation.action,
      price: validation.price,
      rejectionReason: "Segnale duplicato (entro finestra dedup)",
    });
    return NextResponse.json({
      status: "duplicate",
      message: "Segnale duplicato — ignorato",
      dedupWindowMs: DEDUP_WINDOW_MS,
    });
  }

  // 6. Find matching strategy by pineScriptRef or name
  const payload = body as TradingViewWebhookPayload;
  let strategyId: number | null = null;

  if (payload.strategy_name || payload.pine_id) {
    const ref = payload.strategy_name || payload.pine_id || "";
    const matching = await db
      .select()
      .from(strategies)
      .where(
        and(
          eq(strategies.source, "tradingview_webhook"),
          eq(strategies.pineScriptRef, ref)
        )
      )
      .limit(1);
    if (matching.length > 0) strategyId = matching[0].id;
  }

  // If no matching strategy, create one
  if (!strategyId) {
    const name = payload.strategy_name || `TradingView_${validation.ticker}_${Date.now()}`;
    const newStrat = await db.insert(strategies).values({
      name,
      source: "tradingview_webhook",
      category: "custom",
      sourceDescription: `Strategia ricevuta via webhook TradingView. Ticker: ${validation.ticker}, Azione: ${validation.action}, Prezzo: ${validation.price}.`,
      entryRulesJson: JSON.stringify([]),
      exitRulesJson: JSON.stringify([]),
      parametersJson: JSON.stringify({}),
      pineScriptRef: payload.strategy_name || payload.pine_id || name,
      status: "watch",
      statusReason: "Strategia TradingView webhook — in osservazione iniziale (più lunga, nessun backtest tradizionale)",
      isDemo: true,
    });
    strategyId = Number(newStrat.lastInsertRowid);
  }

  // 7. Generate signal and log
  const signal = await db.insert(strategySignals).values({
    strategyId,
    asset: validation.ticker!,
    side: validation.action === "buy" || validation.action === "long" ? "long" : "short",
    signalPrice: validation.price!,
    timestamp: new Date().toISOString(),
    origin: "tradingview_webhook",
    rawDataJson: rawBody,
  });

  const signalId = Number(signal.lastInsertRowid);

  // 8. Log webhook
  await db.insert(tradingViewWebhookLogs).values({
    rawPayload: rawBody,
    tokenValid: true,
    schemaValid: true,
    isDuplicate: false,
    ticker: validation.ticker,
    action: validation.action,
    price: validation.price,
    linkedStrategySignalId: signalId,
  });

  // 9. Make decision asynchronously (respond quickly)
  // For now, paper_copy for all valid signals
  const decision = await db.insert(decisionJournal).values({
    strategySignalId: signalId,
    strategyId,
    decision: "paper_copy",
    confidenceScore: 0.7,
    reasonsJson: JSON.stringify(["Segnale webhook TradingView valido", "Paper trading automatico"]),
    risksJson: JSON.stringify(["Nessun backtest tradizionale per questa strategia"]),
    simulatedPositionSize: 100,
  });

  // 10. Open paper trade
  await openPaperTrade(
    Number(decision.lastInsertRowid),
    strategyId,
    validation.ticker!,
    validation.action === "buy" || validation.action === "long" ? "long" : "short",
    validation.price!,
    100
  );

  const elapsed = Date.now() - startTime;

  return NextResponse.json({
    status: "processed",
    signalId,
    strategyId,
    ticker: validation.ticker,
    action: validation.action,
    price: validation.price,
    decision: "paper_copy",
    elapsedMs: elapsed,
  });
}