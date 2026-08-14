import { Candle, MarketDataProvider } from "./types";

// Bitget public API v2: no auth needed for kline/candles
// Docs: https://bitget.github.io/apidoc/en/mix/#get-candlestick-data

export class BitgetProvider implements MarketDataProvider {
  name = "bitget";

  async fetchCandles(
    asset: string,
    timeframe: string,
    from: Date,
    to: Date
  ): Promise<Candle[]> {
    const productType = "USDT-FUTURES";
    const granularity = this.timeframeToGranularity(timeframe);
    const start = Math.floor(from.getTime());
    const end = Math.floor(to.getTime());

    // Strip trailing "USDT" if present — API v2 expects bare symbol
    const symbol = asset.endsWith("USDT") ? asset : `${asset}USDT`;

    const url = `https://api.bitget.com/api/v2/mix/market/candles?productType=${productType}&symbol=${symbol}&granularity=${granularity}&startTime=${start}&endTime=${end}&limit=1000`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Bitget API error: ${res.status} ${res.statusText} for ${asset}`);
    }

    const data = await res.json();
    if (data.code !== "00000" || !data.data || !Array.isArray(data.data)) {
      throw new Error(`Bitget: errore API per ${asset} — ${data.msg || JSON.stringify(data).slice(0, 200)}`);
    }

    return data.data.map((c: string[]) => ({
      timestamp: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[6]),
    }));
  }

  private timeframeToGranularity(tf: string): string {
    const map: Record<string, string> = {
      "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
      "1h": "1H", "4h": "4H", "6h": "6H", "12h": "12H",
      "1d": "1D", "1w": "1W",
    };
    return map[tf] || "1H";
  }
}