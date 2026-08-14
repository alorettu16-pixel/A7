# A7 Agent Instructions

## Modelli
- **deepseek-v4-flash** (via OpenRouter): scoring, valutazione strategie, decisioni, rule engine
- **llama3.1:8b** (locale): raccolta dati, backtest meccanici, generazione report

## Sicurezza
- Paper trading di default. Live trading solo con flag esplicito
- Le chiavi API exchange vanno configurate con permessi di solo trading, mai withdrawal
- L'endpoint webhook TradingView è protetto da token condiviso
- Non chiedere né memorizzare chiavi private di wallet
- Non simulare mai dati storici, live, o segnali webhook falsi
- I dati demo sono chiaramente etichettati con `is_demo: true`

## Regole operative
- Prima di ogni comando SQL DELETE senza WHERE, chiedere conferma
- Ogni strategia trovata sul web va riassunta con parole proprie citando la fonte
- Non inventare metriche di performance non verificabili
- TradingView non offre API pubblica — solo webhook da alert Pine Script
- RiskLimits, liveTradingEnabled, whitelist strategie/broker sono solo manuali, mai modificabili da codice automatico