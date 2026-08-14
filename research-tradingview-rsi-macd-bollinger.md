# TradingView Community Strategy Research — BTC/ETH 4H
## RSI+MACD and Bollinger+RSI combos (win rate target >40%)

**Date:** 2026-08-14
**Source:** TradingView community published scripts + GitHub Pine mirrors (hasnocool/tradingview-pine-scripts).
**Note:** Web tooling (search/extract) was unavailable; research done via DuckDuckGo HTML + GitHub raw source pulls. TradingView script pages themselves block scraping (CloudFront 403), so full source for directly-TradingView-hosted pages was obtained from the open Git mirrors of the same scripts.

---

## TOP 3 RECOMMENDED STRATEGIES

### 1. MACD Signal with RSI Indicating Strategy (RSI + MACD)
- **Author:** smartstang23 (community; mirrored in hasnocool/tradingview-pine-scripts)
- **URL:** https://github.com/hasnocool/tradingview-pine-scripts/blob/main/MACD%20Signal%20with%20RSI%20Indicating%20Strategy.pine
- **Type:** Momentum / trend-following, MACD crossover + RSI oversold/overbought confirmation
- **Timeframe:** No fixed TF (tunable) — backtest from Mar-2021; suitable on 4h.

**ENTRY — LONG**
- MACD(12,26,9) line crosses ABOVE its signal line (`cross(currMacd, signal)` with `currMacd > signal`)
- AND RSI(14) was <= `RSIOverSold` (def 37) on any of the last 6 bars (`rsi[0..5] <= 37`)
- AND position headroom available (`posToTrade > 0`)
- → `strategy.order("long", strategy.long)`

**ENTRY — SHORT (partial scale-out, not a short open)**
- MACD crosses BELOW signal line (`currMacd < signal`)
- AND RSI was >= `RSIOverBought` (def 69) on any of the last 6 bars (`rsi[0..5] >= 69`)
- → sells `position_size*(1/sellRate)` (def sellRate=2, i.e. half the position)

**EXITS:** Trailing position-size management only; no hard TP/SL in base script.
- **Inputs:** fastMA=12, slowMA=26, signalLength=9, RSI len=14, RSIOverSold=37, RSIOverBought=69, sellRate=2, maxPos=15000, pyramiding=4.
- **Best mapped to A7 as:** `macd(crosses_above,0)` + `rsi(btwn/below 37)` → LONG; exit via `rsi(above 69)` / reverse (no hard SL/TP — add A7 SL/TP).

---

### 2. Bollinger Band with RSI (Bollinger + RSI, mean reversion)
- **Author:** lolnopls (community; mirrored in hasnocool/tradingview-pine-scripts)
- **URL:** https://github.com/hasnocool/tradingview-pine-scripts/blob/main/Bollinger%20Band%20with%20RSI.pine
- **Type:** Mean reversion — BUY bounce off lower BB confirmed by oversold RSI. Clean match for A7 `bbands` + `rsi`.
- **Timeframe:** TF-agnostic; works on 4h.

**ENTRY — LONG**
- RSI(14) < 30 (oversold)
- AND close < lower Bollinger Band (BB len=20, mult=2.0)
- → `strategy.entry("Long", long, when=entry_long)`

**EXIT — LONG**
- Target: Take-profit at avg-price * 1.10 (TP 10%)
- Stop: `avg_price * (1 - 0.25)` (SL 25%)
- Trailing-exit: RSI crosses above 70 → `strategy.close("Long")`
- Inputs: RSI len=14, oversold=30, overbought=70, BB len=20, BB mult=2.0, long TP=10%, long SL=25%.
- **Best mapped to A7 as:** `rsi(below 30)` + `bbands(below lower)` → LONG; exit `rsi(above 70)` OR `tp(10%)` / `sl(25%)`.
  - (A7 paper engine applies its global TP +2% / SL -1% / trailing automatically.)

---

### 3. Bollinger Bands, RSI, and MA Strategy (Bollinger + RSI + trend filter)
- **Author:** Monkeyfish85 (community; mirrored in hasnocool/tradingview-pine-scripts)
- **URL:** https://github.com/hasnocool/tradingview-pine-scripts/blob/main/Bollinger%20Bands%2C%20RSI%2C%20and%20MA%20Strategy.pine
- **Type:** Trend-following / volatility-expansion breakout using BB width contraction + RSI extremes + MA exit.
- **Timeframe:** TF-agnostic; works on 4h.

**ENTRY — LONG**
- RSI(14) > overbought (def 70)  [momentum continuation, NOT fade]
- AND Bollinger bands NOT contracting (`ta.stdev[0] >= ta.stdev[1]`, i.e. volatility expanding)
- → `strategy.entry("Long", long)`

**ENTRY — SHORT**
- RSI(14) < oversold (def 30)
- AND BB not contracting
- → `strategy.entry("Short", short)`

**EXIT — LONG:** close < MA(50 SMA)
**EXIT — SHORT:** close > MA(50 SMA)

- Inputs: BB len=20, BB mult=2.0, minor BB deviation=1.0, RSI len=14, OB=70, OS=30, MA len=50 SMA, SL=1.0% (input, auto-close on close<ma in source).
- **Best mapped to A7 as:** `rsi(above 70)` and `bbands` width-expanding filter + `ma_crossover(above,50)` for exit; exit via `ema/macd`-trend reverse.

---

## Other strong candidates (verified, backup picks)

- **Bollinger Bands strategy with RSI and MACD v1.0** (juliangonzaconde) — triple combo. Entry LONG: BB lower-band flush + MACD hist crossover (`hist[2]<0`, `hist[1]>=0`, `hist>=0`) + RSI(14) < 30 (buy) and <69 (sell) non-block. Exits: 4% trailing stop, 3% max TP long/short, partial-close 50% at mid-band. Uses arrays (maxOrders=2) — **needs refactor to map into A7** (no arrays).
- **RSI + MACD Multi-Timeframe Strategy** (RWCS_LTD, TradingView `Epqb0L8C`) — Daily RSI + **4H MACD** long entry/exit. Published 2025-11. Multi-TF (`request.security`) — not directly A7-compatible; logic: long when daily RSI signals dip + 4H MACD momentum confirms. Best expressed in A7 as `rsi` (higher frame via another candle stream) + `macd`.
- **Easy to Use MACD+RSI Strategy** (TradingView `06gU5i7b`) — beginner MACD with RSI confirming; clean simple rule set.

---

## A7 COMPATIBILITY NOTES
All three top picks use only indicators the A7 rules engine supports:
`macd` (fast/slow/signal), `rsi` (period), `bbands` (period/stdDev), `ma_crossover` (fast/slow), `volume`.
Conditions map cleanly: `above/below`, `crosses_above`, `btwn`.

**Caveats:**
- None of the mirrored scripts publish an explicit "win rate" number; the 70% win-rate claim in the workspace's existing `SCALP MACD12/26/9 PSAR EMA200` entry (daviddtech) is the only documented figure of that kind in this project. The three above are picked for rule clarity + community popularity + clean A7 mapping; **win rate >40% must be confirmed via the A7 backtest** (IS/OOS, 4h BTC+ETH).
- Candidate #3 enters on RSI extremes as momentum (fade the fade) — verify behavior on 4h before promoting.
- Refactor needs: #1 uses manual RSI recompute (A7 has native `rsi`), #3 uses `ta.stdev` width filter (represent as `bbands` width via two bbands inputs or skip), #2 maps 1:1 cleanest.
