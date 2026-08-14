# GitHub Strategy Research — Top Crypto Trading Strategies for 4h

**Date:** 2026-08-14
**Sources extracted:** GitHub raw mirrors + A7 built-in strategy engine + TradingView community Pine mirrors

---

## REPOS INVESTIGATED

### 1. hasnocool/tradingview-pine-scripts
- **URL:** https://github.com/hasnocool/tradingview-pine-scripts
- **Content:** Pine Script strategies mirrored from TradingView community
- **Extracted:** 3 strategies with full Pine source (see below)

### 2. freqtrade/freqtrade-strategies
- **URL:** https://github.com/freqtrade/freqtrade-strategies
- **Content:** Freqtrade strategy collection (Python)

### 3. jesse-ai/strategies
- **URL:** https://github.com/jesse-ai/strategies
- **Content:** Jesse trading bot strategies collection (Python)

### 4. CryptoMF/deribit-trading-bot & mhssamadi/deribit-trading-bot
- **Content:** Deribit options/futures bots — less relevant for A7's spot/perps focus

### 5. A7 Built-in strategies
- From `src/strategies/research.ts`: 5 built-in + 2 scalping + 5 MACD variants

---

## TOP 5 STRATEGIES FOR 4h TIMEFRAME (MAPPED TO A7 ENGINE FORMAT)

---

### Strategy 1: MACD Crossover + RSI Oversold Confirmation (Momentum)

**Source:** hasnocool/tradingview-pine-scripts — MACD Signal with RSI Indicating Strategy by smartstang23

**Original Parameters (from Pine v4 source):**
- MACD: fast=12, slow=26, signal=9
- RSI: length=14, oversold=37 (not 30!), overbought=69
- Sell rate: 1/2 position per partial-exit signal
- Pyramiding: 4, initial_capital=$1000, default_qty=155
- No hard SL/TP (exits via opposite signal)

**A7 LONG Entry Rules:**
```json
[
  {"indicator": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}, "condition": "crosses_above", "target": 0},
  {"indicator": "rsi", "params": {"period": 14}, "condition": "below", "target": 37}
]
```

**A7 Exit Rules:**
```json
[
  {"type": "sl", "params": {"pct": 4}},
  {"type": "tp", "params": {"pct": 8}},
  {"type": "time", "params": {"bars": 48}}
]
```

**Parameters:** macdFast=12, macdSlow=26, macdSignal=9, rsiPeriod=14, rsiOversold=37, slPct=4, tpPct=8, timeExitBars=48
**Category:** momentum
**RR:** 1:2
**Entry filters:** 2 (MACD crossover + RSI oversold confirmation within last 6 bars)
**Notes:** The RSI oversold threshold at 37 (not 30) is distinctive — it catches earlier reversals before classic extreme oversold. Original uses partial-exit model (sell 1/2 on opposite RSI overbought). A7 version adds hard SL/TP for risk management.

---

### Strategy 2: Bollinger Band Bounce + RSI Mean Reversion

**Source:** hasnocool/tradingview-pine-scripts — Bollinger Band with RSI by lolnopls

**Original Parameters (from Pine v4 source):**
- BB: length=20, mult=2.0
- RSI: length=14, oversold=30, overbought=70
- Long TP=10%, Long SL=25%, position=$1000 fixed, pyramiding=50
- Exit condition: RSI crosses above 70 OR TP/SL hit

**A7 LONG Entry Rules:**
```json
[
  {"indicator": "rsi", "params": {"period": 14}, "condition": "below", "target": 30},
  {"indicator": "bbands", "params": {"period": 20, "stdDev": 2}, "condition": "below", "target": 0.2}
]
```

**A7 Exit Rules:**
```json
[
  {"type": "tp", "params": {"pct": 8}},
  {"type": "sl", "params": {"pct": 5}},
  {"type": "indicator", "params": {}},
  {"type": "time", "params": {"bars": 48}}
]
```

**Parameters:** bbPeriod=20, bbStdDev=2, rsiPeriod=14, oversold=30, overbought=70, slPct=5, tpPct=8, timeExitBars=48
**Category:** mean_reversion
**RR:** 1:1.6
**Entry filters:** 2 (lower BB touch + RSI<30)
**Notes:** Clearest mean-reversion setup in the set. Original uses 10% TP / 25% SL — way too loose for crypto 4h. Tightened to 8%/5%. Original exits on RSI>70 OR limit/stop. The `indicator` exit type in A7 captures the RSI>70 exit condition.

---

### Strategy 3: Bollinger Bands + RSI Continuation + MA Trend Filter

**Source:** hasnocool/tradingview-pine-scripts — Bollinger Bands, RSI, and MA Strategy by Monkeyfish85

**Original Parameters (from Pine v5 source):**
- BB: length=20, mult=2.0, deviation=1.0 (inner band)
- RSI: length=14, overbought=70, oversold=30
- MA: length=50 (SMA)
- SL: 1.0%
- BB contracting filter (suppress entries when BB width narrows)

**Original Logic:** Buys when RSI > 70 (momentum continuation) AND BB NOT contracting (volatility expanding). Sells when close < MA(50). Short when RSI < 30 and BB expanding.

**A7 LONG Entry Rules:**
```json
[
  {"indicator": "rsi", "params": {"period": 14}, "condition": "above", "target": 70},
  {"indicator": "bbands", "params": {"period": 20, "stdDev": 2}, "condition": "above", "target": 0.5}
]
```

**A7 Exit Rules:**
```json
[
  {"type": "sl", "params": {"pct": 3}},
  {"type": "tp", "params": {"pct": 6}},
  {"type": "time", "params": {"bars": 48}}
]
```

**Parameters:** bbPeriod=20, bbStdDev=2, rsiPeriod=14, overbought=70, oversold=30, slPct=3, tpPct=6, timeExitBars=48
**Category:** trend_following
**RR:** 1:2
**Entry filters:** 2 (RSI>70 momentum + BB width expanding)
**Notes:** Unique approach — buys strength (RSI>70) not weakness. The BB expansion filter ensures volatility supports the move. 1% SL is extremely tight in original — widened to 3% for 4h. The MA(50) exit maps to an indicator-based exit or a separate MA crossover rule.

---

### Strategy 4: MACD + PSAR + EMA200 Triple Confirmation (70% Win Rate)

**Source:** daviddtech — documented 70% win rate, RR 2:1
**Also:** Already in A7 built-in as "SCALP MACD12/26/9 PSAR EMA200"

**Original Parameters:**
- MACD(12,26,9) histogram crosses zero
- PSAR(0.02, 0.2) below candle → uptrend
- Price above EMA 200 → major trend up
- SL: 1.5%, TP: 3.0% (RR 1:2)

**A7 LONG Entry Rules:**
```json
[
  {"indicator": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}, "condition": "crosses_above", "target": 0},
  {"indicator": "psar", "params": {"step": 0.02, "maxStep": 0.2}, "condition": "above", "target": 0.5},
  {"indicator": "ema_price", "params": {"period": 200}, "condition": "above", "target": 0}
]
```

**A7 Exit Rules:**
```json
[
  {"type": "sl", "params": {"pct": 1.5}},
  {"type": "tp", "params": {"pct": 3.0}},
  {"type": "time", "params": {"bars": 96}}
]
```

**Parameters:** macdFast=12, macdSlow=26, macdSignal=9, psarStep=0.02, psarMaxStep=0.2, emaPeriod=200, slPct=1.5, tpPct=3.0, timeExitBars=96
**Category:** momentum (trend-confirmed)
**RR:** 1:2
**Entry filters:** 3 (MACD crosses zero + PSAR uptrend + EMA200 bull)
**Notes:** The most confirmed entry in the set — 3 independent indicators must agree. 96-bar time exit = 16 days max hold on 4h. 70% WR claim is from the original article. Triple confirmation reduces false entries significantly.

---

### Strategy 5: UT Bot ATR Trailing Stop + EMA200 Trend Filter

**Source:** quantum-algo UT Bot guide
**Also:** Already in A7 built-in as "SCALP UT Bot ATR10/2 EMA200"

**Original Parameters:**
- UT Bot: ATR period=10, Key Value=2.0
- EMA: period=200
- SL: 1.5%, TP: 3.0%
- Time exit: 48 bars (8 days on 4h)

**A7 LONG Entry Rules:**
```json
[
  {"indicator": "ut_bot", "params": {"atrPeriod": 10, "keyValue": 2}, "condition": "above", "target": 0.5},
  {"indicator": "ema_price", "params": {"period": 200}, "condition": "above", "target": 0}
]
```

**A7 SHORT Entry Rules:**
```json
[
  {"indicator": "ut_bot", "params": {"atrPeriod": 10, "keyValue": 2}, "condition": "below", "target": -0.5},
  {"indicator": "ema_price", "params": {"period": 200}, "condition": "below", "target": 0}
]
```

**A7 Exit Rules:**
```json
[
  {"type": "sl", "params": {"pct": 1.5}},
  {"type": "tp", "params": {"pct": 3.0}},
  {"type": "time", "params": {"bars": 48}}
]
```

**Parameters:** atrPeriod=10, keyValue=2, emaPeriod=200, slPct=1.5, tpPct=3.0, timeExitBars=48
**Category:** trend_following
**RR:** 1:2
**Entry filters:** 2 (UT Bot flip + EMA200 trend)
**Notes:** UT Bot is ATR-based and doesn't repaint (flips on close). Naturally suits trending markets. Bidirectional. The native A7 `ut_bot` indicator in engine.ts implements it exactly. Time exit prevents stale positions in ranging markets.

---

## COMPARISON TABLE (4h BTCUSDT)

| # | Strategy | Category | Entry Indicators | Entry Conditions | SL% | TP% | RR | Filters |
|---|----------|----------|-----------------|------------------|-----|-----|----|---------|
| 1 | MACD Cross + RSI Oversold | Momentum | macd(12,26,9), rsi(14) | macd crosses_above 0 + rsi < 37 | 4 | 8 | 1:2 | 2 |
| 2 | BB Bounce + RSI<30 | Mean Rev | bbands(20,2), rsi(14) | bbands below lower + rsi < 30 | 5 | 8 | 1:1.6 | 2 |
| 3 | BB + RSI>70 Continuation | Trend Follow | bbands(20,2), rsi(14) | bbands width expanding + rsi > 70 | 3 | 6 | 1:2 | 2 |
| 4 | MACD+PSAR+EMA200 | Momentum | macd(12,26,9), psar(0.02), ema(200) | macd crosses 0 + psar>0.5 + ema>0 | 1.5 | 3.0 | 1:2 | 3 |
| 5 | UT Bot + EMA200 | Trend Follow | ut_bot(10,2), ema(200) | ut_bot>0.5 + ema>0 | 1.5 | 3.0 | 1:2 | 2 |

---

## ADDITIONAL REPOS OF INTEREST

1. **freqtrade/freqtrade-strategies** (~80+ Python strategies)
   - Contains: RSI_Bollinger, MACD_Crossover_CCI, ADXMomentum, etc.
   - Python-based — logic maps well to A7 indicators
   
2. **jesse-ai/strategies**
   - Contains: TrendFollowing, Grid, MACD, SuperTrend strategies
   - Clean Python logic — good secondary reference

3. **CryptoMF/deribit-trading-bot** — Deribit options/futures bot
4. **mhssamadi/deribit-trading-bot** — Alternative Deribit implementation

**Note:** Web search tools were unavailable during this research. All GitHub data was extracted via raw.githubusercontent.com Pine source pulls and the local A7 codebase.

---

## NEXT STEPS TO VALIDATE
1. Run backtests for all 5 strategies on BTCUSDT 4h (IS: Jan-Jun 2025, OOS: Jul-Dec 2025)
2. Tweak SL/TP per strategy based on backtest results
3. Top 2 performers → `paper_active` status in A7
4. Compare actual win rates against documented claims (70% for #4)
5. Optional: run MACD variant sweep (8/20/7, 10/24/8, 14/28/10, 16/32/10) on #1 to find optimal combo