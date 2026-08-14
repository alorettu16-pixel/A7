import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "a7.log");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function timestamp(): string {
  return new Date().toISOString();
}

export function log(level: "INFO" | "WARN" | "ERROR" | "TRADE", message: string): void {
  const line = `[${timestamp()}] [${level}] ${message}`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export function logSignal(asset: string, strategy: string, side: string, price: number, tradeId: number, size: number): void {
  const line = `[${timestamp()}] [TRADE] 📈 ${asset} ${strategy}: ${side} @ ${price} — Trade #${tradeId} (size: ${size}$)`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export function logClose(tradeId: number, asset: string, reason: string, pnl: number): void {
  const line = `[${timestamp()}] [TRADE] 🔒 Trade #${tradeId} ${asset} chiuso: ${reason} (PnL: ${pnl.toFixed(2)}$)`;
  console.log(`  ${line}`);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export function logError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const line = `[${timestamp()}] [ERROR] ${context}: ${msg}`;
  console.error(`  ❌ ${context}: ${msg}`);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export function logBlock(reason: string): void {
  const line = `[${timestamp()}] [WARN] 🛑 ${reason}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export function getLogPath(): string {
  return LOG_FILE;
}

export function getRecentLogs(lines: number = 50): string {
  try {
    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const allLines = content.trim().split("\n");
    return allLines.slice(-lines).join("\n");
  } catch {
    return "Nessun log disponibile.";
  }
}