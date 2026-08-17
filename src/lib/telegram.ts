import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Carica .env manualmente per tsx (che non lo fa automaticamente)
function loadEnv(): void {
  if (process.env.TELEGRAM_BOT_TOKEN) return;
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function sendTelegram(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const ok = res.ok;
    if (!ok) {
      const body = await res.text();
      console.error(`Telegram error ${res.status}: ${body.slice(0, 200)}`);
    }
    return ok;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Telegram error: ${msg}`);
    return false;
  }
}

export function formatStatus(strategies: number, open: number, exposure: number, maxExposure: number, realizedPnl: number, unrealizedPnl: number, closed: number, wins: number): string {
  const emoji = realizedPnl >= 0 ? "🟢" : "🔴";
  const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(0) : "N/A";
  return [
    `*A7 — Status Update*`,
    ``,
    `📊 Strategie attive: ${strategies}`,
    `💼 Posizioni aperte: ${open}`,
    `🛡 Esposizione: ${exposure.toFixed(0)}$ / ${maxExposure.toFixed(0)}$`,
    `💰 PnL realizzato: ${emoji} ${realizedPnl.toFixed(2)}$`,
    `📈 PnL non realizzato: ${unrealizedPnl.toFixed(2)}$`,
    `📉 Trades chiusi: ${closed} (win ${wins}, win rate ${winRate}%)`,
  ].join("\n");
}

export function formatTradeOpen(tradeId: number, asset: string, side: string, price: number, size: number, strategy: string): string {
  const icon = side === "long" ? "📈" : "📉";
  return [
    `${icon} *Nuovo trade aperto*`,
    `#${tradeId} ${asset} ${side.toUpperCase()}`,
    `Entry: ${price}`,
    `Size: ${size}$`,
    `Strategia: ${strategy}`,
  ].join("\n");
}

export function formatTradeClose(tradeId: number, asset: string, side: string, entry: number, exit: number, pnl: number, reason: string, strategy: string): string {
  const emoji = pnl >= 0 ? "🟢" : "🔴";
  const sign = pnl >= 0 ? "+" : "";
  return [
    `${emoji} *Trade chiuso*`,
    `#${tradeId} ${asset} ${side.toUpperCase()}`,
    `Entry: ${entry} → Exit: ${exit}`,
    `PnL: ${sign}${pnl.toFixed(2)}$`,
    `Motivo: ${reason}`,
    `Strategia: ${strategy}`,
  ].join("\n");
}

export function formatSignal(asset: string, strategy: string, side: string, price: number): string {
  const icon = side === "long" ? "📈" : "📉";
  return `${icon} *Segnale* ${asset} ${side.toUpperCase()} @ ${price} (${strategy})`;
}

export function formatAlert(title: string, body: string): string {
  return [`🚨 *${title}*`, ``, body].join("\n");
}

export function formatStartup(): string {
  return `✅ *A7 — Sistema avviato*\nIl ciclo trading è online.`;
}

export function formatError(asset: string, context: string, detail: string): string {
  return [`⚠️ *Errore* ${asset}`, `Contesto: ${context}`, `Dettaglio: ${detail.slice(0, 120)}`].join("\n");
}