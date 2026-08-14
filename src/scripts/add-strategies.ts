import Database from "better-sqlite3";
import * as path from "path";

const db = new Database(path.join(process.cwd(), "a7.db"));

const strategies = [
  {
    name: "ALWAYS MOVIMENTO 0.3% TP0.5 SL0.3",
    category: "momentum",
    summary: "Entra LONG quando il prezzo sale dello 0.3% in 3 candele (micro-trend). Entra SHORT quando scende dello 0.3%. TP 0.5%, SL 0.3%. Funziona in qualsiasi condizione di mercato perché reagisce a movimenti minimi. Time exit 2h.",
    entryRules: [
      { indicator: "price_change", params: { periods: 3 }, condition: "above", target: 0.3 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 0.3 } },
      { type: "tp", params: { pct: 0.5 } },
      { type: "time", params: { bars: 8 } },
    ],
    parameters: { priceChangePeriods: 3, threshold: 0.3, slPct: 0.3, tpPct: 0.5, timeExit: 2 },
  },
  {
    name: "ALWAYS MEAN REV RSI 14/40-60 TP1 SL0.5",
    category: "mean_reversion",
    summary: "Mean reversion pura: entra LONG quando RSI(14) < 40 (vicino a ipervenduto) e torna sopra. Entra SHORT quando RSI > 60 (vicino a ipercomprato) e torna sotto. Condizioni above/below semplici, non aspetta crossover. TP 1%, SL 0.5%. Time exit 4h.",
    entryRules: [
      { indicator: "rsi", params: { period: 14 }, condition: "btwn", target: 35, upper: 65 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 0.5 } },
      { type: "tp", params: { pct: 1.0 } },
      { type: "time", params: { bars: 16 } },
    ],
    parameters: { rsiPeriod: 14, oversold: 35, overbought: 65, slPct: 0.5, tpPct: 1.0, timeExit: 4 },
  },
  {
    name: "ALWAYS GRID CANDELA TP0.3 SL0.2",
    category: "grid",
    summary: "Grid scalping aggression: entra LONG su ogni candela verde (close > open), SHORT su ogni candela rossa (close < open). Non aspetta nulla — opera su ogni movimento. TP 0.3%, SL 0.2%. Time exit 30 minuti (2 candele 15m). Massima frequenza operativa.",
    entryRules: [
      { indicator: "candle_direction", params: {}, condition: "above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 0.2 } },
      { type: "tp", params: { pct: 0.3 } },
      { type: "time", params: { bars: 2 } },
    ],
    parameters: { slPct: 0.2, tpPct: 0.3, timeExit: 0.5 },
  },
  // ─── Nuove strategie MACD 4h con filtri (ricerca web + dati backtest A7) ───
  {
    name: "MACD 12/26/9 + RSI14>50 SL4 TP8",
    category: "momentum",
    summary: "MACD 12/26/9 con filtro RSI(14)>50 conferma trend rialzista. Basato su CoinQuant: 6 anni BTC 4h, +581%, Sharpe 1.24, drawdown -22.4%. Entry: MACD crosses_above signal AND RSI>50. Exit: SL 4%, TP 8%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "crosses_above", target: 0 },
      { indicator: "rsi", params: { period: 14 }, condition: "above", target: 50 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 4 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { fast: 12, slow: 26, sig: 9, rsiPeriod: 14, rsiThresh: 50, sl: 4, tp: 8 },
  },
  {
    name: "MACD 10/24/8 SL4 TP8",
    category: "momentum",
    summary: "MACD variante ottimizzata 10/24/8. Più veloce del classico 12/26/9, cattura trend più brevi su 4h. Backtest A7: MACD 4h è il timeframe migliore. SL 4%, TP 8%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 10, slow: 24, signal: 8 }, condition: "crosses_above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 4 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { fast: 10, slow: 24, sig: 8, sl: 4, tp: 8 },
  },
  {
    name: "MACD 14/28/10 SL4 TP8",
    category: "momentum",
    summary: "MACD variante più lenta 14/28/10. Filtra più rumore del classico 12/26/9, adatto a trend 4h più ampi. Backtest A7: MACD 4h domina. SL 4%, TP 8%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 14, slow: 28, signal: 10 }, condition: "crosses_above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 4 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { fast: 14, slow: 28, sig: 10, sl: 4, tp: 8 },
  },
  {
    name: "MACD 12/26/9 + EMA20 SL4 TP8",
    category: "momentum",
    summary: "MACD 12/26/9 con trend filter EMA20: prezzo > EMA20 (solo trend rialzista). Entry: MACD crosses_above signal AND prezzo sopra EMA20. Exit: SL 4%, TP 8%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "crosses_above", target: 0 },
      { indicator: "ema_price", params: { period: 20 }, condition: "above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 4 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { fast: 12, slow: 26, sig: 9, emaPeriod: 20, sl: 4, tp: 8 },
  },
  {
    name: "MACD 12/26/9 + EMA50 SL5 TP10",
    category: "momentum",
    summary: "MACD 12/26/9 con trend filter EMA50 forte: prezzo > EMA50 (solo trend strutturale). Basato su CoinQuant V3: Sharpe 1.32, drawdown -16.8%. Entry: MACD crosses_above signal AND prezzo sopra EMA50. Exit: SL 5%, TP 10%.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "crosses_above", target: 0 },
      { indicator: "ema_price", params: { period: 50 }, condition: "above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 10 } },
    ],
    parameters: { fast: 12, slow: 26, sig: 9, emaPeriod: 50, sl: 5, tp: 10 },
  },
  {
    name: "MACD 12/26/9 + EMA200 SL5 TP10",
    category: "momentum",
    summary: "MACD 12/26/9 con trend filter EMA200 fortissimo: solo trend primario rialzista. Basato su CoinQuant V3: max Sharpe (1.32), min drawdown (-16.8%). Entry: MACD crosses_above signal AND prezzo sopra EMA200. Exit: SL 5%, TP 10%. Solo LONG. Poche entry ma alta qualità.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "crosses_above", target: 0 },
      { indicator: "ema_price", params: { period: 200 }, condition: "above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 5 } },
      { type: "tp", params: { pct: 10 } },
    ],
    parameters: { fast: 12, slow: 26, sig: 9, emaPeriod: 200, sl: 5, tp: 10 },
  },
  {
    name: "MACD 8/20/7 + EMA20 SL3 TP7",
    category: "momentum",
    summary: "MACD 8/20/7 (più veloce) con filtro EMA20. Cattura trend più reattivi. Entry: MACD crosses_above signal AND prezzo > EMA20. Exit: SL 3%, TP 7%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 8, slow: 20, signal: 7 }, condition: "crosses_above", target: 0 },
      { indicator: "ema_price", params: { period: 20 }, condition: "above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 3 } },
      { type: "tp", params: { pct: 7 } },
    ],
    parameters: { fast: 8, slow: 20, sig: 7, emaPeriod: 20, sl: 3, tp: 7 },
  },
  {
    name: "MICRO MACD 5/13/4 + EMA10 SL1 TP2",
    category: "momentum",
    summary: "MICRO MACD 5/13/4 con filtro EMA10. Per timeframe 15m. Basato sulle MICRO MACD esistenti che hanno mostrato migliori performance. Entry: MACD crosses_above signal AND prezzo > EMA10. SL 1%, TP 2%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 5, slow: 13, signal: 4 }, condition: "crosses_above", target: 0 },
      { indicator: "ema_price", params: { period: 10 }, condition: "above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 1 } },
      { type: "tp", params: { pct: 2 } },
    ],
    parameters: { fast: 5, slow: 13, sig: 4, emaPeriod: 10, sl: 1, tp: 2 },
  },
  {
    name: "MACD 16/32/10 SL4 TP8",
    category: "momentum",
    summary: "MACD 16/32/10 — variante ancora più lenta del 14/28/10. Filtra massimo rumore, cattura solo trend 4h forti. Entry: MACD crosses_above signal. Exit: SL 4%, TP 8%. Solo LONG.",
    entryRules: [
      { indicator: "macd", params: { fast: 16, slow: 32, signal: 10 }, condition: "crosses_above", target: 0 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 4 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { fast: 16, slow: 32, sig: 10, sl: 4, tp: 8 },
  },
  {
    name: "MACD 12/26/9 PULLBACK EMA20 SL4 TP8",
    category: "trend_following",
    summary: "MACD 12/26/9 + pullback su EMA20. Entra LONG quando MACD è positivo (trend up) e prezzo ritorna su EMA20 (pullback). Entry: MACD above 0 AND prezzo <= EMA20*1.005 (vicino EMA20). Cattura ingressi su ritracciamento in trend. SL 4%, TP 8%.",
    entryRules: [
      { indicator: "macd", params: { fast: 12, slow: 26, signal: 9 }, condition: "above", target: 0 },
      { indicator: "ema_price", params: { period: 20 }, condition: "above", target: -0.5 },
    ],
    exitRules: [
      { type: "sl", params: { pct: 4 } },
      { type: "tp", params: { pct: 8 } },
    ],
    parameters: { fast: 12, slow: 26, sig: 9, emaPeriod: 20, sl: 4, tp: 8 },
  },
];

for (const s of strategies) {
  const existing = db.prepare("SELECT id FROM strategies WHERE name = ?").get(s.name) as any;
  if (existing) {
    console.log(`Esiste gia: "${s.name}"`);
    continue;
  }
  db.prepare(`
    INSERT INTO strategies (name, source, category, source_description, entry_rules_json, exit_rules_json, parameters_json, status, is_demo)
    VALUES (?, 'web_research', ?, ?, ?, ?, ?, 'paper_active', 1)
  `).run(
    s.name, s.category, s.summary,
    JSON.stringify(s.entryRules),
    JSON.stringify(s.exitRules),
    JSON.stringify(s.parameters),
  );
  console.log(`Creata: "${s.name}" (paper_active)`);
}

console.log(`\nTotale strategie: ${(db.prepare("SELECT COUNT(*) as c FROM strategies").get() as any).c}`);
console.log(`Paper active: ${(db.prepare("SELECT COUNT(*) as c FROM strategies WHERE status = 'paper_active'").get() as any).c}`);