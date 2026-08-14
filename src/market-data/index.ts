import { Candle } from "./types";
import { BitgetProvider } from "./bitget-provider";
import { BinanceProvider } from "./binance-provider";
import db, { marketDataCache } from "@/db";
import { eq, and } from "drizzle-orm";

const providers = {
  bitget: new BitgetProvider(),
  binance: new BinanceProvider(),
} as const;

export type ExchangeName = keyof typeof providers;

// Bitget API v2 max window: 90 days per request
const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// Fetch candles with caching and chunking for API limits
export async function getCandles(
  asset: string,
  timeframe: string,
  from: Date,
  to: Date,
  exchange: ExchangeName = "bitget"
): Promise<Candle[]> {
  const provider = providers[exchange];
  if (!provider) throw new Error(`Unknown exchange: ${exchange}`);

  // Check cache first
  const cached = await db
    .select()
    .from(marketDataCache)
    .where(
      and(
        eq(marketDataCache.asset, asset),
        eq(marketDataCache.exchange, exchange),
        eq(marketDataCache.timeframe, timeframe),
      )
    )
    .limit(1);

  if (cached.length > 0) {
    const cachedCandles: Candle[] = JSON.parse(cached[0].candlesJson);
    const cacheStart = new Date(cached[0].rangeStart).getTime();
    const cacheEnd = new Date(cached[0].rangeEnd).getTime();
    const requestStart = from.getTime();
    const requestEnd = to.getTime();

    if (cacheStart <= requestStart && cacheEnd >= requestEnd) {
      return cachedCandles.filter(
        (c) => c.timestamp >= requestStart && c.timestamp <= requestEnd
      );
    }
  }

  // Fetch in chunks of 90 days to respect Bitget API limit
  let allCandles: Candle[] = [];
  let chunkStart = from.getTime();
  const endMs = to.getTime();

  while (chunkStart < endMs) {
    const chunkEnd = Math.min(chunkStart + MAX_WINDOW_MS, endMs);
    const chunk = await provider.fetchCandles(
      asset,
      timeframe,
      new Date(chunkStart),
      new Date(chunkEnd)
    );
    allCandles = allCandles.concat(chunk);
    chunkStart = chunkEnd;
  }

  // Deduplicate by timestamp
  const seen = new Set<number>();
  allCandles = allCandles.filter(c => {
    if (seen.has(c.timestamp)) return false;
    seen.add(c.timestamp);
    return true;
  });

  // Sort by timestamp ascending
  allCandles.sort((a, b) => a.timestamp - b.timestamp);

  if (allCandles.length === 0) {
    throw new Error(`No data returned for ${asset} ${timeframe} from ${exchange}`);
  }

  // Update cache
  if (cached.length > 0) {
    await db
      .delete(marketDataCache)
      .where(eq(marketDataCache.id, cached[0].id));
  }

  await db.insert(marketDataCache).values({
    asset,
    exchange,
    timeframe,
    candlesJson: JSON.stringify(allCandles),
    rangeStart: from.toISOString(),
    rangeEnd: to.toISOString(),
  });

  return allCandles;
}