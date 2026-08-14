import { Candle, MarketDataProvider } from "./types";

// Binance public API: no auth needed for klines
// Docs: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data

export class BinanceProvider implements MarketDataProvider {
  name = "binance";

  async fetchCandles(
    asset: string,
    timeframe: string,
    from: Date,
    to: Date
  ): Promise<Candle[]> {
    const interval = this.timeframeToInterval(timeframe);
    const startMs = from.getTime();
    const endMs = to.getTime();

    const url = `https://api.binance.com/api/v3/klines?symbol=${asset}USDT&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=1000`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.status} ${res.statusText} for ${asset}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error(`Binance: unexpected response format for ${asset} — ${JSON.stringify(data).slice(0, 200)}`);
    }

    return data.map((c: (number | string)[]) => ({
      timestamp: c[0] as number,
      open: parseFloat(c[1] as string),
      high: parseFloat(c[2] as string),
      low: parseFloat(c[3] as string),
      close: parseFloat(c[4] as string),
      volume: parseFloat(c[5] as string),
    }));
  }

  private timeframeToInterval(tf: string): string {
    const map: Record<string, string> = {
      "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
      "1h": "1h", "4h": "4h", "6h": "6h", "12h": "12h",
      "1d": "1d", "1w": "1w",
    };
    return map[tf] || "1h";
  }
}