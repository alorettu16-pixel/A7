import { getCandles } from "@/market-data";
import { BacktestParams } from "@/backtest/engine";

const params: BacktestParams = { initialCapital: 10000, commissionPct: 0.1, slippagePct: 0.05, positionSizePct: 10 };

function volumeSMA(candles: any[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    const sum = candles.slice(i - period + 1, i + 1).reduce((s: number, c: any) => s + c.volume, 0);
    result.push(sum / period);
  }
  return result;
}

function runCustom(candles: any[], volAvg: number[], side: "long" | "short", withVolumeFilter: boolean) {
  let equity = params.initialCapital;
  let position: any = null;
  const trades: any[] = [];

  for (let i = 55; i < candles.length; i++) {
    const c = candles[i];

    // Exit check
    if (position) {
      let exitPrice: number | null = null;
      let exitReason: string | null = null;

      if (position.side === "long" && c.low <= position.entryPrice * 0.98) {
        exitPrice = position.entryPrice * 0.98; exitReason = "stop_loss";
      } else if (position.side === "short" && c.high >= position.entryPrice * 1.02) {
        exitPrice = position.entryPrice * 1.02; exitReason = "stop_loss";
      }
      if (!exitPrice && position.side === "long" && c.high >= position.entryPrice * 1.04) {
        exitPrice = position.entryPrice * 1.04; exitReason = "take_profit";
      } else if (!exitPrice && position.side === "short" && c.low <= position.entryPrice * 0.96) {
        exitPrice = position.entryPrice * 0.96; exitReason = "take_profit";
      }
      if (!exitPrice && i - position.entryIdx >= 6) {
        exitPrice = c.close; exitReason = "time_exit";
      }

      if (exitPrice) {
        const pnl = position.side === "long"
          ? (exitPrice - position.entryPrice) / position.entryPrice * position.size
          : (position.entryPrice - exitPrice) / position.entryPrice * position.size;
        const fee = position.size * 0.001 * 2;
        equity += pnl - fee;
        trades.push({ pnl: pnl - fee, exitReason });
        position = null;
      }
    }

    // Entry check
    if (!position && i < candles.length - 1) {
      if (withVolumeFilter && c.volume < volAvg[i] * 1.2) continue;

      const closes = candles.slice(0, i + 1).map((x: any) => x.close);
      if (closes.length < 30) continue;

      const k12 = 2 / 13, k26 = 2 / 27;
      let ema12 = closes.slice(0, 12).reduce((a: number, b: number) => a + b, 0) / 12;
      let ema26 = closes.slice(0, 26).reduce((a: number, b: number) => a + b, 0) / 26;
      for (let j = 12; j < closes.length; j++) ema12 = closes[j] * k12 + ema12 * (1 - k12);
      for (let j = 26; j < closes.length; j++) ema26 = closes[j] * k26 + ema26 * (1 - k26);
      const macdLine = ema12 - ema26;

      // Build MACD histo array for signal line
      const macds: number[] = [];
      for (let j = Math.max(0, i - 30); j <= i; j++) {
        const subCloses = candles.slice(0, j + 1).map((x: any) => x.close);
        if (subCloses.length < 26) continue;
        let e12 = subCloses.slice(0, 12).reduce((a: number, b: number) => a + b, 0) / 12;
        let e26 = subCloses.slice(0, 26).reduce((a: number, b: number) => a + b, 0) / 26;
        for (let k = 12; k < subCloses.length; k++) e12 = subCloses[k] * k12 + e12 * (1 - k12);
        for (let k = 26; k < subCloses.length; k++) e26 = subCloses[k] * k26 + e26 * (1 - k26);
        macds.push(e12 - e26);
      }

      const sigLine = macds.length >= 9 ? macds.slice(-9).reduce((a: number, b: number) => a + b, 0) / 9 : 0;
      const prevMacds = macds.length >= 10 ? macds.slice(-10, -1) : macds.slice(0, -1);
      const prevSig = prevMacds.length >= 9 ? prevMacds.slice(-9).reduce((a: number, b: number) => a + b, 0) / 9 : 0;
      const histo = macdLine - sigLine;
      const prevHisto = prevMacds.length > 0 ? (prevMacds[prevMacds.length - 1] - prevSig) : 0;

      if (side === "long" && histo > 0 && prevHisto <= 0) {
        position = { side: "long", entryPrice: c.close, size: equity * 0.1, entryIdx: i };
        equity -= equity * 0.1 * 0.001;
      } else if (side === "short" && histo < 0 && prevHisto >= 0) {
        position = { side: "short", entryPrice: c.close, size: equity * 0.1, entryIdx: i };
        equity -= equity * 0.1 * 0.001;
      }
    }
  }

  // Close last
  if (position) {
    const last = candles[candles.length - 1].close;
    const pnl = position.side === "long"
      ? (last - position.entryPrice) / position.entryPrice * position.size
      : (position.entryPrice - last) / position.entryPrice * position.size;
    equity += pnl - position.size * 0.001;
    trades.push({ pnl, exitReason: "end" });
  }

  const totalReturn = equity - params.initialCapital;
  const wins = trades.filter((t: any) => t.pnl > 0).length;
  const losses = trades.filter((t: any) => t.pnl < 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : "N/A";
  return { trades: trades.length, wins, losses, totalReturn: Math.round(totalReturn * 100) / 100, winRate };
}

async function test(asset: string, tf: string, label: string, withVolumeFilter: boolean) {
  const now = new Date();
  const from = new Date(now.getTime() - 180 * 86400000);
  const candles = await getCandles(asset, tf, from, now, "bitget");
  if (candles.length < 60) { console.log(`  ${label}: ⚠ insufficienti`); return null; }

  const volAvg = volumeSMA(candles, 20);
  const longRes = runCustom(candles, volAvg, "long", withVolumeFilter);
  const shortRes = runCustom(candles, volAvg, "short", withVolumeFilter);
  const total = longRes.trades + shortRes.trades;
  const totalPnl = longRes.totalReturn + shortRes.totalReturn;
  const totalWins = longRes.wins + shortRes.wins;
  const totalWR = total > 0 ? (totalWins / total * 100).toFixed(1) : "N/A";

  console.log(`  ${label}:`);
  console.log(`    LONG:  ${longRes.trades}t (${longRes.wins}W/${longRes.losses}L) → ${longRes.totalReturn >= 0 ? "+" : ""}$${longRes.totalReturn}  WR ${longRes.winRate}%`);
  console.log(`    SHORT: ${shortRes.trades}t (${shortRes.wins}W/${shortRes.losses}L) → ${shortRes.totalReturn >= 0 ? "+" : ""}$${shortRes.totalReturn}  WR ${shortRes.winRate}%`);
  console.log(`    TOT:   ${total}t → ${totalPnl >= 0 ? "+" : ""}$${totalPnl}  WR ${totalWR}%`);

  return { total, totalPnl, totalWins, label };
}

async function main() {
  console.log("=== CONFRONTO MACD: Volume Filter ON vs OFF ===\n");

  const pairs = [
    { asset: "BTC", tf: "4h" },
    { asset: "ETH", tf: "4h" },
    { asset: "SOL", tf: "4h" },
    { asset: "BNB", tf: "4h" },
  ];

  let puroTotal = 0, volTotal = 0;
  let puroTrades = 0, volTrades = 0;

  for (const p of pairs) {
    console.log(`\n--- ${p.asset} ${p.tf} ---`);
    const puro = await test(p.asset, p.tf, "MACD PURO (no volume)", false);
    console.log("");
    const vol = await test(p.asset, p.tf, "MACD + VOLUME (1.2x media 20)", true);

    if (puro && vol) {
      puroTotal += puro.totalPnl;
      puroTrades += puro.total;
      volTotal += vol.totalPnl;
      volTrades += vol.total;
    }
    console.log("");
  }

  console.log("=".repeat(50));
  console.log("RIEPILOGO TOTALE (4 asset):");
  console.log(`  MACD PURO:        ${puroTrades}t → $${puroTotal.toFixed(2)}`);
  console.log(`  MACD + VOLUME:    ${volTrades}t → $${volTotal.toFixed(2)}`);
  console.log(`  DIFFERENZA:       ${volTotal - puroTotal >= 0 ? "+" : ""}$${(volTotal - puroTotal).toFixed(2)}`);
  console.log(`  TRADES RIDOTTI:   ${puroTrades - volTrades} in meno (${puroTrades > 0 ? ((puroTrades - volTrades) / puroTrades * 100).toFixed(0) : 0}% meno trades)`);
}

main().catch(console.error);