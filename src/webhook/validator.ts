// Types for the TradingView webhook payload and validation

export interface TradingViewWebhookPayload {
  ticker: string;
  action: "buy" | "sell" | "close" | string;
  price: string | number;
  exchange?: string;
  strategy_name?: string;
  pine_id?: string;
  [key: string]: unknown;
}

export interface WebhookValidationResult {
  tokenValid: boolean;
  schemaValid: boolean;
  ticker: string | null;
  action: string | null;
  price: number | null;
  rejectionReason: string | null;
}

const EXPECTED_TOKEN = process.env.TRADINGVIEW_WEBHOOK_SECRET || "mia-chiave-segreta-cambiami";

export function validateWebhookToken(token: string | null): boolean {
  return token === EXPECTED_TOKEN;
}

export function validateWebhookPayload(
  body: unknown
): WebhookValidationResult {
  const result: WebhookValidationResult = {
    tokenValid: true,
    schemaValid: false,
    ticker: null,
    action: null,
    price: null,
    rejectionReason: null,
  };

  if (!body || typeof body !== "object") {
    result.schemaValid = false;
    result.rejectionReason = "Payload non è un oggetto JSON";
    return result;
  }

  const payload = body as Record<string, unknown>;

  if (!payload.ticker || typeof payload.ticker !== "string") {
    result.rejectionReason = "Campo 'ticker' mancante o non valido";
    return result;
  }

  if (!payload.action || typeof payload.action !== "string") {
    result.rejectionReason = "Campo 'action' mancante o non valido";
    return result;
  }

  const validActions = ["buy", "sell", "close", "long", "short", "exit", "close_all"];
  if (!validActions.includes(payload.action.toLowerCase())) {
    result.rejectionReason = `Azione '${payload.action}' non riconosciuta. Valori validi: ${validActions.join(", ")}`;
    return result;
  }

  if (payload.price === undefined || payload.price === null) {
    result.rejectionReason = "Campo 'price' mancante";
    return result;
  }

  const price = typeof payload.price === "string" ? parseFloat(payload.price) : (typeof payload.price === "number" ? payload.price : NaN);
  if (isNaN(price) || price <= 0) {
    result.rejectionReason = `Campo 'price' non valido: ${payload.price}`;
    return result;
  }

  result.schemaValid = true;
  result.ticker = payload.ticker.toUpperCase();
  result.action = payload.action.toLowerCase();
  result.price = price;
  result.rejectionReason = null;
  return result;
}

// Simple in-memory dedup cache (last 100 entries, 5-minute window)
const dedupCache = new Map<string, number>();

export const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function checkDuplicate(
  ticker: string,
  action: string,
  price: number
): boolean {
  const key = `${ticker}:${action}:${price.toFixed(2)}`;
  const now = Date.now();
  const last = dedupCache.get(key);

  if (last && now - last < DEDUP_WINDOW_MS) {
    return true; // Duplicate
  }

  dedupCache.set(key, now);

  // Clean old entries
  if (dedupCache.size > 100) {
    const cutoff = now - DEDUP_WINDOW_MS;
    for (const [k, v] of dedupCache) {
      if (v < cutoff) dedupCache.delete(k);
    }
  }

  return false;
}