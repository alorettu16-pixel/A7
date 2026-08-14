# A7 — Multi-Strategy Research, Backtest & Live Trading System

**Sicurezza prima di tutto.** A7 opera in paper trading di default. L'esecuzione reale su broker è un modulo separato, disabilitato, attivabile solo manualmente.

## Cos'è A7

A7 è un sistema multi-agente per creare, testare e far operare strategie di trading algoritmico. Gestisce:
- Ricerca di strategie documentate online
- Strategy Builder (interfaccia guidata, nessun codice necessario)
- Ricezione di alert Pine Script da TradingView via webhook
- Backtest rigoroso su dati storici reali (Bitget/Binance) con separazione IS/OOS
- Paper trading con commissioni e slippage realistici
- Webhook TradingView con validazione token, schema e deduplica
- Auto-miglioramento parametri (con blocchi rigidi su RiskLimits)
- Dashboard completa e animata
- Report giornalieri automatici
- Modulo esecuzione reale (disabilitato di default)

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Lucide React, Recharts
- **Backend:** Next.js API Routes, Drizzle ORM + SQLite (better-sqlite3)
- **Dati Mercato:** API pubbliche Bitget (primario) e Binance (fallback)
- **Webhook:** TradingView alert → POST JSON → endpoint protetto con token

## Comandi

```bash
# Dashboard
npm run dev              # Avvia dashboard in locale (http://localhost:3000)
npm run build            # Build di produzione
npm run start            # Avvia build di produzione

# Database
npm run db:generate      # Genera migrazioni Drizzle
npm run db:migrate       # Applica migrazioni
npm run db:studio        # Apri Drizzle Studio

# Seed & Setup
npm run seed             # Carica strategie built-in e risk limits

# Operazioni
npm run research:strategies  # Ricerca nuove strategie
npm run backtest:run         # Esegue backtest su tutte le strategie in stato research
npm run signals:generate     # Genera segnali dalle strategie attive
npm run paper:update-pnl     # Aggiorna PnL paper trading
npm run full-cycle           # Ciclo completo: segnali → PnL → revisione → parametri
npm run review:outcomes      # Revisione trade conclusi
npm run update:params        # Aggiornamento automatico parametri
npm run report:daily         # Genera report giornaliero
npm run webhook:test         # Simula webhook TradingView

# Test
npm run test              # Esegue test suite
```

## Configurazione TradingView Webhook

### Passo 1: Configurare l'alert in TradingView

1. Apri il tuo chart su TradingView
2. Aggiungi una strategia Pine Script (o usa un indicatore con alert)
3. Crea un nuovo alert (clicca campanella → "Crea alert")
4. Nella sezione "Webhook URL", inserisci:
   - Locale con tunnel: `https://il-tuo-tunnel.ngrok.io/api/webhooks/tradingview?token=IL_TUO_TOKEN`
   - Su Vercel: `https://il-tuo-sito.vercel.app/api/webhooks/tradingview?token=IL_TUO_TOKEN`
5. Nel campo "Message", incolla il JSON:

```json
{
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": "{{close}}",
  "exchange": "BYBIT",
  "strategy_name": "NomeStrategia"
}
```

### Passo 2: Token di sicurezza

Il token condiviso è configurato in `.env` come `TRADINGVIEW_WEBHOOK_SECRET`.
Il default è `mia-chiave-segreta-cambiami` — **cambialo prima di esporre l'endpoint**.

### Formato payload accettato

```json
{
  "ticker": "BTCUSDT",          // Obbligatorio
  "action": "buy",              // buy, sell, close, long, short, exit
  "price": "65000.50",          // Obbligatorio
  "exchange": "BYBIT",          // Opzionale
  "strategy_name": "MiaStrat",  // Opzionale
  "pine_id": "abc123"           // Opzionale
}
```

## Configurazione Broker (per Live Trading futuro)

A7 supporta un'interfaccia comune per adapter broker. Implementazioni iniziali:
- **Bitget** (API pubblica senza auth per dati, chiavi necessarie solo per trading reale)
- **Binance** (stessa filosofia)

Per configurare le chiavi:

```bash
# Nel file .env
BITGET_API_KEY=your_key
BITGET_API_SECRET=your_secret
BITGET_API_PASSPHRASE=your_passphrase
```

**IMPORTANTE:** Le chiavi vanno configurate con permessi di SOLO TRADING, mai withdrawal.
Il modulo live trading è disabilitato di default (`liveTradingEnabled: false`).

## Passaggi per attivare Live Trading

1. Avere almeno 3-4 settimane di paper trading stabile
2. Backtest superato con Sharpe > 0.5, drawdown < 30%, almeno 30 trade OOS
3. Paper trading allineato al backtest (deviazione < 20%)
4. Modificare manualmente `risk_limits.live_trading_enabled = true` nel DB
5. Aggiungere strategie autorizzate a `allowed_strategies_json`
6. Aggiungere broker autorizzati a `allowed_brokers_json`
7. Verificare `BrokerConnection.permissionsVerified` (solo trading, mai withdrawal)
8. Attivare kill switch e circuit breaker

## Esporre l'endpoint webhook in locale

Per test locali, usa ngrok o un tunnel simile:

```bash
ngrok http 3000
# Copia l'URL HTTPS generato (es. https://abc123.ngrok.io)
# Configuralo in TradingView come: https://abc123.ngrok.io/api/webhooks/tradingview?token=IL_TUO_TOKEN
```

## Deploy su Vercel

```bash
npm run build
npx vercel --prod
```

**Attenzione:** Vercel serverless ha timeout di 10s per gli endpoint API.
L'endpoint webhook risponde rapidamente e processa in modo asincrono.

## Struttura del progetto

```
a7/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   ├── overview/       # API panoramica
│   │   │   ├── strategies/     # API strategie (GET + POST)
│   │   │   └── webhooks/       # Endpoint TradingView webhook
│   │   ├── builder/            # Strategy Builder
│   │   ├── strategie/          # Libreria strategie
│   │   ├── page.tsx            # Panoramica dashboard
│   │   └── layout.tsx          # Layout principale
│   ├── backtest/               # Motore backtesting
│   │   ├── engine.ts           # Event-driven backtest
│   │   ├── scorer.ts           # Validazione/soglie qualità
│   │   └── runner.ts           # Full backtest IS/OOS
│   ├── components/             # Componenti UI
│   │   └── side-nav.tsx        # Navigazione laterale
│   ├── db/                     # Database
│   │   ├── schema.ts           # Schema Drizzle completo
│   │   └── index.ts            # Connessione SQLite
│   ├── market-data/            # Provider dati
│   │   ├── types.ts
│   │   ├── bitget-provider.ts  # API pubblica Bitget
│   │   ├── binance-provider.ts # API pubblica Binance
│   │   └── index.ts            # Cache + fetch
│   ├── paper-trading/          # Motore paper trading
│   │   └── engine.ts
│   ├── params/                 # Aggiornamento parametri
│   │   └── updater.ts
│   ├── report/                 # Report giornaliero
│   │   └── generator.ts
│   ├── review/                 # Revisione esiti
│   │   └── outcomes.ts
│   ├── risk/                   # Risk limits
│   │   └── limits.ts
│   ├── scripts/                # Script CLI
│   │   ├── seed.ts
│   │   ├── run-backtest.ts
│   │   ├── generate-signals.ts
│   │   ├── update-pnl.ts
│   │   ├── review-outcomes.ts
│   │   ├── daily-report.ts
│   │   ├── test-webhook.ts
│   │   └── run-tests.ts
│   ├── signals/                # Generatore segnali
│   │   └── generator.ts
│   ├── strategies/             # Ricerca strategie
│   │   └── research.ts
│   └── webhook/                # Validatore webhook
│       └── validator.ts
├── .env.example
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── README.md
└── SAFETY.md
```

## Ruolo dei modelli AI

- **deepseek-v4-flash** (via OpenRouter): scoring, valutazione strategie, decisioni, rule engine
- **llama3.1:8b** (locale): raccolta dati, backtest meccanici, generazione report, web search

## Test

```bash
npm run test
```

La test suite copre:
- Motore backtest (generazione trade, metriche, equity curve)
- Scorer (validazione IS/OOS, soglie)
- Webhook validation (token, schema, payload malformati)
- Deduplicazione (stessa finestra temporale)