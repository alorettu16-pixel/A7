# A7 — Manuale Completo del Sistema

> **Versione**: 0.1.0  
> **Autore**: Alessandro Lorettu (Dylan80)  
> **Piattaforma**: Next.js 16 · TypeScript · Tailwind v4 · Drizzle ORM · SQLite  
> **Exchange**: Bitget (dati pubblici)  
> **Tipo**: Paper Trading — Multi-Strategy Research, Backtest & Automated Trading

---

## Indice

1. [Architettura Generale](#1-architettura-generale)
2. [Dashboard — Pagine Frontend](#2-dashboard--pagine-frontend)
3. [API Routes](#3-api-routes)
4. [Script CLI (npm run)](#4-script-cli)
5. [Core Engine](#5-core-engine)
6. [Database — Schema](#6-database)
7. [Automatismi e Cron](#7-automatismi-e-cron)
8. [Sicurezza e Limiti](#8-sicurezza-e-limiti)

---

## 1. Architettura Generale

A7 è un sistema di trading multi-strategia che opera esclusivamente in **modalità paper trading** (demo). È strutturato come applicazione web Next.js 16 con:

- **Frontend**: Dashboard React lato client con 11 pagine di navigazione
- **Backend API**: 11 route REST per dati e operazioni
- **Script CLI**: 16 script eseguibili via `npm run` per operazioni batch
- **Core Engine**: 7 moduli specializzati (backtest, segnali, paper trading, risk, ecc.)
- **Database**: SQLite con Drizzle ORM, 18 tabelle
- **Cron Jobs**: Automatismi programmati ogni 3 minuti

### Flusso di lavoro principale

```
Ricerca strategie (web) → Backtest → Scoring → Attivazione → Segnali → Paper Trade → PnL → Review
```

Il ciclo completo è automatizzato: ogni 3 minuti il sistema controlla i prezzi BTC/ETH su Bitget, genera segnali, apre paper trade, aggiorna PnL, e chiude posizioni che hanno raggiunto SL/TP/trailing/time.

---

## 2. Dashboard — Pagine Frontend

### 2.1 Panoramica (`/`)

**Homepage del sistema.** Mostra un cruscotto riassuntivo con:

- **Header**: Data corrente e indicatore Live (aggiornamento ogni 30s)
- **Budget Demo**: Saldo del conto virtuale ($500 di default) con PnL totale
- **KPI Cards**:
  - Strategie Attive (conteggio paper_active vs watch)
  - Posizioni Aperte (conteggio win/loss/chiusi)
  - Segnali Oggi
- **Performance**: Realizzato, Non realizzato, Totale
- **Win Rate**: Percentuale vittorie/perdite con grafico circolare
- **Commissioni**: Totale fees accumulate (0.1% per trade)
- **Live Trading**: Stato (DISABILITATO/ATTIVO)
- **Posizioni Aperte**: Lista delle ultime 6 posizioni con dettagli (asset, side, entry, corrente, size, ore aperte, PnL)
- **Trade Chiusi Recenti**: Ultimi 5 trade chiusi
- **Quick Links**: Collegamenti rapidi alle altre sezioni

> **Auto-refresh**: 30 secondi

---

### 2.2 Libreria Strategie (`/strategie`)

Elenco completo di tutte le strategie nel database. Ogni strategia mostra:

- Nome, categoria (trend_following, mean_reversion, momentum, breakout, custom)
- Stato (research, backtesting, paper_active, watch, rejected, live_eligible)
- Descrizione, entry rules, exit rules, parametri
- Backtest risultati (Sharpe, Drawdown, Win Rate, Profit Factor, Trade Count)

**Filtri**: Per stato, categoria  
**Azioni**: Attivare/disattivare strategie per paper trading

---

### 2.3 Strategy Builder (`/builder`)

Interfaccia per creare nuove strategie manualmente. Permette di:

- Selezionare indicatori (MA Crossover, RSI, MACD, Bollinger Bands, Volume)
- Configurare condizioni di entry (above, below, crosses_above, crosses_below, btwn)
- Configurare exit rules (SL, TP, trailing, time, indicatore)
- Salvare la strategia nel database

---

### 2.4 Webhook TradingView (`/webhooks`)

Log di tutti i webhook ricevuti da TradingView. Mostra:

- Payload ricevuto (token, ticker, action, price)
- Validazione (token valido, schema valido, duplicato)
- Stato di elaborazione
- Eventuale trade collegato

**Attenzione**: TradingView non offre API pubblica — solo webhook da alert Pine Script.

---

### 2.5 Segnali Live (`/segnali`)

Elenco cronologico degli ultimi 100 segnali generati. Ogni segnale mostra:

- Asset (BTC, ETH)
- Side (LONG/SHORT)
- Prezzo di segnale
- Origine (Interno / TradingView)
- Strategia che l'ha generato
- Timestamp

**Auto-refresh**: 15 secondi

---

### 2.6 Paper Trades (`/paper-trades`)

Elenco completo di tutti i paper trade. Diviso in due sezioni:

**Posizioni Aperte**: Card con:
- Asset, side, ID trade
- Entry price, current price, size, fee
- PnL non realizzato (percentuale e valore)
- Strategia, data apertura, ore aperte
- Curva PnL (ultimi 50 snapshot)
- Colore bordo: verde (profitto), rosso (perdita), grigio (neutro)

**Trade Conclusi**: Lista compatta con realized PnL, entry/exit, strategia, date

**Auto-refresh**: 15 secondi

---

### 2.7 Diario Decisioni (`/diario`)

Registro di tutte le decisioni prese dal sistema. Ogni entry contiene:

- Strategia coinvolta
- Decisione presa (paper_copy, watchlist, skip, live_execute)
- Confidence score (0-1)
- Motivazioni (JSON)
- Rischi identificati (JSON)
- Simulated position size
- Collegamento al segnale che ha generato la decisione

---

### 2.8 Performance (`/performance`)

Analisi delle performance del sistema. Include:

- **Equity Curve**: Grafico dell'andamento del PnL nel tempo (basato su equity_snapshots)
- **Statistiche**: PnL realizzato, non realizzato, totale
- **Win Rate**: Percentuale vittorie
- **Trade Count**: Operazioni totali
- **ROI**: Return on Investment rispetto al budget demo

---

### 2.9 Regole & Parametri (`/regole`)

Gestione delle regole di trading. Mostra:

- **Rule Sets**: Versioni delle regole per ogni strategia
- **Rule Changes**: Storico delle modifiche alle regole (con before/after JSON)
- Possibilità di visualizzare le modifiche automatiche o manuali

---

### 2.10 Rischio & Esecuzione (`/rischio`)

**Pannello di controllo dei limiti di rischio.** Parametri editabili:

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| Budget Demo | $500 | Capitale virtuale totale |
| Max Drawdown Giornaliero | 10% | Blocco nuovi trade se superato |
| Max Posizione | $100 | Dimensione massima per singolo trade |
| Esposizione Massima | $500 | Mai più del budget demo |
| Leva Massima | 1x | Nessuna leva consentita |

**Stati**:
- **Live Trading**: DISABILITATO (modificabile solo da DB)
- **Kill Switch**: ATTIVO/DISATTIVO — blocca automaticamente nuovi ordini se drawdown giornaliero superato
- **Whitelist**: Strategie e broker autorizzati al live trading (modificabile solo da DB)

**Sicurezza**: I parametri liveTradingEnabled, allowedStrategies e allowedBrokers sono modificabili solo manualmente nel database. Il sistema automatico non può alterarli (regola hard-coded da AGENTS.md).

---

### 2.11 Report (`/report`)

Report giornaliero generato automaticamente. Include:

- Data del report
- Paper PnL del giorno
- Win Rate giornaliero
- Posizioni aperte/chiuse
- Nuovi segnali
- Webhook TradingView ricevuti
- Strategie attive e rifiutate
- Cambiamenti alle regole
- Deviation alerts (scostamenti dai backtest)
- Stato live trading
- Riepilogo testuale
- Flag sentToTelegram (se inviato)

---

## 3. API Routes

### 3.1 `GET /api/overview`
Dati per la homepage. Restituisce:
- `hasStrategies`, `totalPnl`, `realizedPnl`, `unrealizedPnl`
- `activeStrategies`, `openPositions`
- `signalsToday`, `webhooksToday`
- `liveTradingEnabled`, `budgetDemo`
- `equityCurve` (ultimi 50 snapshot)

### 3.2 `GET /api/trades`
Lista degli ultimi 100 paper trade con dettagli arricchiti (nome strategia, curva PnL).

### 3.3 `GET /api/strategies`
Elenco di tutte le strategie.

### 3.4 `GET /api/signals`
Ultimi 100 segnali con nome strategia.

### 3.5 `GET /api/webhooks`
Log dei webhook TradingView ricevuti.

### 3.6 `POST /api/webhooks/tradingview`
Endpoint per ricevere webhook da TradingView. Valida:
- Token (condiviso)
- Schema (ticker, action, price)
- Duplicati (stesso payload = scartato)
- Normalizza ticker (maiuscolo) e action (minuscolo)

### 3.7 `GET /api/risk`
Legge i limiti di rischio correnti.

### 3.8 `PUT /api/risk`
Aggiorna i limiti di rischio (maxDrawdown, maxPosition, maxExposure, leverage, budget).

### 3.9 `GET /api/diary`
Decision journal entries.

### 3.10 `GET /api/backtests`
Risultati dei backtest eseguiti.

### 3.11 `GET /api/report`
Report giornaliero più recente.

### 3.12 `POST /api/run`
Endpoint per eseguire comandi (seed, backtest, signals, pnl, report, webhook) — usato dalla homepage per il ciclo "Avvia".

---

## 4. Script CLI

Tutti eseguibili via `npm run <nome>`.

### 4.1 `npm run dev`
Avvia il server di sviluppo Next.js (porta 3000/3001).

### 4.2 `npm run build`
Compila il progetto per produzione.

### 4.3 `npm run start`
Avvia il server in produzione.

### 4.4 `npm run lint`
Esegue ESLint.

### 4.5 `npm run typecheck`
Controllo tipi TypeScript (`tsc --noEmit`).

### 4.6 `npm run db:generate`
Genera migrazioni Drizzle Kit.

### 4.7 `npm run db:migrate`
Applica migrazioni al database.

### 4.8 `npm run db:studio`
Avvia Drizzle Studio (interfaccia grafica DB).

### 4.9 `npm run seed`
Carica le 5 strategie built-in (EMA Crossover, RSI Mean Reversion, MACD, Bollinger, Volume Breakout).

### 4.10 `npm run research:strategies`
Carica strategie dalla ricerca web (built-in). Non duplica se già esistenti.

### 4.11 `npm run backtest:run`
Esegue backtest su tutte le strategie con stato `research` su BTC/ETH 15m/1h/4h. Le strategie che passano i criteri vengono promosse a `paper_active`.

### 4.12 `npm run signals:generate`
**Script principale per la generazione segnali.** Esegue:
1. Verifica Kill Switch — se attivo, blocca tutto
2. Calcola drawdown giornaliero — se ≥ maxDrawdownPct, blocca
3. Calcola esposizione totale — se ≥ budget disponibile, blocca
4. **Reverse Signal Check**: Per ogni trade aperto con exit rule "indicator", verifica se l'indicatore è ancora valido. Se non lo è, chiude il trade
5. Scansiona BTC e ETH su candele 1m (ultimi 30 minuti)
6. Per ogni strategia paper_active, valuta le entry rules
7. Se trova un setup, apre un paper trade con size adattiva (min(maxPositionSize, budgetResiduo))

### 4.13 `npm run paper:update-pnl`
Aggiorna PnL di tutti i paper trade aperti. Esegue:
1. Chiude forzatamente trade aperti da più di 48h (stale)
2. Scarica candele 1m (ultimi 10 minuti) per ogni asset
3. Calcola highest/lowest price per trailing stop
4. Verifica exit rules: **Stop Loss** (-1%), **Take Profit** (+2%), **Trailing Stop** (attiva dopo +1%, trailing 0.5%), **Time Exit** (48h)
5. Se una exit rule scatta, chiude il trade
6. Registra snapshot PnL

### 4.14 `npm run full-cycle`
Esegue in sequenza: signals → update-pnl → review-outcomes → update-params

### 4.15 `npm run review:outcomes`
Analizza i trade chiusi e classifica il risultato (win/loss/breakeven). Confronta con le aspettative del backtest per calcolare deviation.

### 4.16 `npm run update:params`
Aggiorna i parametri delle strategie in base ai risultati delle review.

### 4.17 `npm run report:daily`
Genera il report giornaliero con tutte le statistiche del giorno.

### 4.18 `npm run webhook:test`
Invia un webhook di test fittizio all'endpoint TradingView per verificare il funzionamento.

### 4.19 `npm run test`
Esegue la suite di test (19 test): backtest engine, scorer, webhook validation, deduplicazione.

### 4.20 Script di utilità

- `npm run db-check`: Verifica integrità database
- `npm run demo-signals`: Genera segnali demo fittizi
- `npm run reset-and-seed`: Resetta DB e ricarica dati iniziali
- `npm run reset-strategies`: Resetta solo le strategie
- `npm run activate-some`: Attiva strategie specifiche
- `npm run add-strategies`: Aggiunge strategie personalizzate
- `npm run sweep-seed`: Carica 45 varianti di strategie con parametri sweep

---

## 5. Core Engine

### 5.1 Backtest Engine (`src/backtest/engine.ts`)

Motore di backtest principale. Simula l'esecuzione di una strategia su dati storici.

**Input**: Candle[], StrategyRules, BacktestParams
**Output**: BacktestResult con trades[], totalReturn, maxDrawdown, sharpeRatio, winRate, profitFactor, tradeCount, finalEquity, equityCurve[]

**Exit rules**: sl, tp, trailing, indicator, time
**Entry rules**: ma_crossover, rsi, macd, bbands, volume

---

### 5.2 Backtest Scorer (`src/backtest/scorer.ts`)

Valuta la qualità del backtest. Punteggio 0-100:
- Sharpe Ratio (20pt, soglia >= 0.1)
- Max Drawdown (20pt, soglia <= 40%)
- Win Rate (20pt, soglia >= 25%)
- Profit Factor (20pt, soglia >= 1.0)
- Trade Count (20pt, soglia >= 5)

Passaggio: score >= 50 e nessun fatal issue. Dati divisi 70/30 IS/OOS.

---

### 5.3 Backtest Runner (`src/backtest/runner.ts`)

Backtest multi-asset e multi-timeframe (BTC/ETH su 15m/1h/4h). Scarica candele da Bitget, divide 70/30, esegue backtest, se supera promuove a paper_active, altrimenti rejected.

---

### 5.4 Signal Generator (`src/signals/generator.ts`)

Genera segnali in tempo reale. Per ogni strategia paper_active: pre-computa indicatori, valuta entry rules sulle ultime 5 candele, se tutte le condizioni sono soddisfatte genera segnale LONG. Non apre se c'è già un trade aperto per la stessa strategia sullo stesso asset.

---

### 5.5 Paper Trading Engine (`src/paper-trading/engine.ts`)

Cuore del sistema di esecuzione simulata. Gestisce ciclo di vita dei paper trade.

**Funzioni**: openPaperTrade, updatePaperTradePnl, closePaperTrade, updateAllOpenPnL, forceCloseStaleTrades

**Exit rules automatiche** (applicate a tutti i trade):
| Rule | Valore | Descrizione |
|------|--------|-------------|
| Take Profit | +2% | Chiude a +2% |
| Stop Loss | -1% | Chiude a -1% |
| Trailing Stop | Attiva +1%, trailing 0.5% | Blocca profitti dal picco |
| Time Exit | 48 ore | Chiude trade bloccati |

**PnL**: Long = (exit-entry)/entry*size; Short = (entry-exit)/entry*size. Fee 0.1% entry + exit.

---

### 5.6 Market Data Provider (`src/market-data/`)

Fornitore dati di mercato Bitget (primario) + Binance (fallback). API v2 Bitget, endpoint candele, caching SQLite, chunking 90gg. Timeframe: 1m, 5m, 15m, 30m, 1h, 4h, 1d.

---

### 5.7 Webhook Validator (`src/webhook/validator.ts`)

Valida payload TradingView: token (TRADINGVIEW_WEBHOOK_SECRET), schema (ticker, action, price), duplicati (cache 5 minuti, 100 entry). Azioni valide: buy, sell, close, long, short, exit, close_all.

---

### 5.8 Outcome Review (`src/review/outcomes.ts`)

Analizza trade chiusi: determina esito (win/loss/breakeven), calcola deviation dal backtest, registra lessons.

---

### 5.9 Parameter Updater (`src/params/updater.ts`)

Aggiorna parametri strategie in base alle review. Mantiene versioni (strategy_versions), before/after JSON, tracciabilità (rule_changes).

---

### 5.10 Report Generator (`src/report/generator.ts`)

Report giornaliero: PnL, win rate, posizioni, segnali, webhook, strategie, cambiamenti regole, deviation alerts, riepilogo AI.

---

## 6. Database — Schema

SQLite, 18 tabelle, Drizzle ORM.

**strategies**: id, name, source, category, entryRulesJson, exitRulesJson, parametersJson, status, isDemo
**strategy_versions**: versionamento parametri per strategia
**market_data_cache**: candele OHLCV cacheate
**backtest_runs**: risultati backtest con metriche
**backtest_trades**: trade individuali del backtest
**tradingview_webhook_logs**: log webhook ricevuti
**strategy_signals**: segnali generati
**decision_journal**: decisioni del sistema
**paper_trades**: paper trade eseguiti
**pnl_snapshots**: snapshot PnL periodici
**outcome_reviews**: review trade chiusi
**rule_sets**: versioni regole per strategia
**rule_changes**: storico modifiche regole
**risk_limits**: limiti di rischio globali
**broker_connections**: connessioni exchange
**live_trade_logs**: log ordini reali
**daily_reports**: report giornalieri
**equity_snapshots**: equity totale nel tempo

---

## 7. Automatismi e Cron

### 7.1 Cron Job Principale
**Nome**: A7 ciclo operativo
**Schedule**: Ogni 3 minuti
**Esecuzione**:
1. signals:generate — controlla risk limits, reverse signal, nuovi segnali BTC/ETH 1m
2. update-pnl — aggiorna prezzi, SL/TP/trailing/time, chiude trade
3. daily-report — report giornaliero

### 7.2 Full Cycle Manuale
npm run full-cycle: signals -> update-pnl -> review-outcomes -> update-params

### 7.3 Auto-refresh Dashboard
Panoramica: 30s | Paper Trades: 15s

---

## 8. Sicurezza e Limiti

### 8.1 Principi
- Paper trading di default, live solo con flag esplicito manuale
- Chiavi API: solo trading, mai withdrawal
- Webhook protetto da token condiviso
- Nessuna chiave privata wallet
- Dati demo etichettati is_demo: true

### 8.2 Risk Limits Automatici
| Controllo | Blocco |
|-----------|--------|
| Kill Switch | Tutti i nuovi segnali |
| Drawdown giornaliero | Se >= maxDrawdownPct |
| Esposizione massima | Se esposizione >= budget disponibile |
| Reverse Signal | Chiude trade se indicatore invertito |
| Stop Loss -1% | Chiude trade in perdita |
| Take Profit +2% | Chiude trade in profitto |
| Trailing Stop | Blocca profitti dopo +1% |
| Time Exit 48h | Chiude trade bloccati |

### 8.3 Whitelist (manuali)
liveTradingEnabled, allowedStrategies, allowedBrokers — solo modificabili da DB.

### 8.4 Limiti Architetturali
- TradingView: solo webhook, nessuna API pubblica
- Bitget: solo dati pubblici
- Live trading: modulo disabilitato di default

---

## 9. Strategie Attive (18 paper_active)

| ID | Nome | Categoria | Entry |
|----|------|-----------|-------|
| 166 | RSI Oversold 14/35 SL4 TP8 | mean_reversion | RSI(14) > 35 |
| 168 | MACD 8/20/7 SL3 TP7 | momentum | MACD(8,20,7) > 0 |
| 169 | MACD 12/26/9 SL4 TP8 | momentum | MACD(12,26,9) > 0 |
| 170 | MACD 16/30/9 SL4 TP9 | momentum | MACD(16,30,9) > 0 |
| 172 | MACD 8/26/7 SL3 TP8 | momentum | MACD(8,26,7) > 0 |
| 173 | MACD 12/30/9 SL4 TP9 | momentum | MACD(12,30,9) > 0 |
| 176 | MACD 8/30/9 SL4 TP8 | momentum | MACD(8,30,9) > 0 |
| 177 | MACD 20/50/12 SL5 TP12 | momentum | MACD(20,50,12) > 0 |
| 178 | Bollinger 16/1.8 SL2.5 TP5 | mean_reversion | BBands < 0.1 |
| 187 | EMA/20+MACD12/26/9 SL4 TP8 | custom | MA cross + MACD > 0 |
| 195 | RSI12/55+EMA20 SL4 TP8 | custom | RSI(12) > 55 + EMA20 |
| 196 | RSI14/55+EMA20 SL4 TP8 | custom | RSI(14) > 55 + EMA20 |
| 197 | RSI14/50+EMA20 SL4 TP8 | custom | RSI(14) > 50 + EMA20 |
| 198 | RSI14/55+EMA30 SL5 TP10 | custom | RSI(14) > 55 + EMA30 |
| 203 | MACD Histogram Trend | momentum | MACD(12,26,9) > 0 |
| 207 | **SCALP MACD 5/13/4 TP1.5 SL0.8** | momentum | MACD(5,13,4) > 0 |
| 208 | **SCALP RSI 7/40 TP1.2 SL0.6** | mean_reversion | RSI(7) > 40 |
| 209 | **SCALP EMA 5/10 TP1 SL0.5** | trend_following | MA cross(5,10) > 0 |

NB: Le strategie SCALP usano le exit rules globali (TP 2%, SL 1%, trailing 0.5%) in paper trading, i loro parametri nominali valgono per il backtest.

---

## 10. Configurazione Ambiente

File .env:
```
TRADINGVIEW_WEBHOOK_SECRET=mia-chiave-segreta-cambiami
DATABASE_URL=file:./a7.db
```

---

*Documento generato il 19/07/2026 — A7 v0.1.0*