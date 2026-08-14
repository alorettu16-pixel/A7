export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataProvider {
  name: string;
  fetchCandles(asset: string, timeframe: string, from: Date, to: Date): Promise<Candle[]>;
}