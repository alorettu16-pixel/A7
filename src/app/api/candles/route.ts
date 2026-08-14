import { NextResponse } from "next/server";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT"];

export async function GET() {
  const results: Record<string, any> = {};

  for (const asset of ASSETS) {
    try {
      const symbol = asset.endsWith("USDT") ? asset : asset + "USDT";
      const now = Date.now();
      const from = now - 86400000 * 2; // ultimi 2 giorni

      const url = `https://api.bitget.com/api/v2/mix/market/candles?productType=USDT-FUTURES&symbol=${symbol}&granularity=1H&startTime=${from}&endTime=${now}&limit=48`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== "00000" || !data.data) {
        results[asset] = { error: data.msg || "No data", candles: [] };
        continue;
      }

      const candles = data.data.map((c: string[]) => ({
        t: parseInt(c[0]),
        o: parseFloat(c[1]),
        h: parseFloat(c[2]),
        l: parseFloat(c[3]),
        c: parseFloat(c[4]),
        v: parseFloat(c[5]),
      }));

      const current = candles[candles.length - 1];
      const change24 = candles.length > 24
        ? ((current.c - candles[candles.length - 25].c) / candles[candles.length - 25].c * 100)
        : 0;

      // Calcola max/min per normalizzazione
      const maxPrice = Math.max(...candles.map((c: any) => c.h));
      const minPrice = Math.min(...candles.map((c: any) => c.l));
      const range = maxPrice - minPrice || 1;

      results[asset] = {
        price: current?.c || 0,
        change24: Math.round(change24 * 100) / 100,
        high24: Math.max(...candles.slice(-24).map((c: any) => c.h)),
        low24: Math.min(...candles.slice(-24).map((c: any) => c.l)),
        candles: candles.slice(-24).map((c: any) => ({
          o: c.o, h: c.h, l: c.l, c: c.c,
          // Normalizza per il rendering (0-1)
          no: (c.o - minPrice) / range,
          nh: (c.h - minPrice) / range,
          nl: (c.l - minPrice) / range,
          nc: (c.c - minPrice) / range,
          isUp: c.c >= c.o,
        })),
        maxPrice,
        minPrice,
        range,
      };
    } catch (e: any) {
      results[asset] = { error: e.message, candles: [] };
    }
  }

  return NextResponse.json(results);
}