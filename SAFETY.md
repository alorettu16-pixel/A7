# SAFETY.md — A7 Trading System

## Principi fondamentali

1. **Nessun consiglio finanziario.** A7 è uno strumento di ricerca e simulazione. Le decisioni di trading reali sono sempre responsabilità dell'utente.

2. **Paper trading di default.** Tutte le operazioni sono simulate finché il modulo live non viene esplicitamente attivato.

3. **Niente chiavi di prelievo.** Le chiavi API exchange vanno configurate con permessi di solo trading, mai withdrawal.

## Rischi specifici

### 1. Segnali TradingView (webhook)

- **Nessun backtest automatico verificabile.** Le strategie Pine Script girano dentro TradingView, i loro risultati di backtest interni non sono accessibili via API. A7 non può validare la qualità del Pine Script scritto dall'utente.
- **Periodo di osservazione più lungo.** Le strategie da TradingView richiedono un periodo di osservazione in paper trading più esteso (almeno 4-6 settimane) prima di essere considerate affidabili, proprio perché manca la validazione out-of-sample tradizionale.
- **Affidabilità del webhook.** Il webhook dipende dalla connettività di rete e dalla corretta configurazione dell'alert su TradingView. Segnali persi o ritardati sono possibili.

### 2. Backtest

- **No look-ahead bias.** Il motore di backtest è progettato per evitare look-ahead bias, ma l'utente è responsabile di verificare che i parametri non siano stati ottimizzati eccessivamente sui dati passati.
- **Separazione IS/OOS.** I dati sono divisi 70/30 tra in-sample (ottimizzazione) e out-of-sample (validazione). Solo le strategie che passano entrambi i test passano a paper trading.
- **Performance passata ≠ futura.** Un backtest positivo non garantisce performance future. I regimi di mercato cambiano.

### 3. Modulo Live Trading (disabilitato di default)

- **Attivazione solo manuale.** `liveTradingEnabled` parte a `false`. Può essere impostato a `true` solo manualmente nel database.
- **Whitelist doppia.** Solo le strategie in `allowedStrategiesJson` e i broker in `allowedBrokersJson` possono eseguire ordini reali. Entrambe le liste sono vuote di default e modificabili solo manualmente.
- **Kill switch automatico.** Se il drawdown giornaliero supera `maxDailyDrawdownPct`, il sistema blocca automaticamente nuovi ordini e notifica. Questa è l'unica restrizione automatica permessa.
- **Circuit breaker.** Se la performance live si discosta troppo dal paper trading, la strategia viene sospesa dal live trading.
- **Log immutabile.** Ogni ordine reale è registrato in `LiveTradeLog` con dettagli completi.

### 4. Dati di mercato

- **Fonti pubbliche.** I dati storici vengono da API pubbliche Bitget/Binance. Non c'è garanzia di completezza o accuratezza.
- **Nessun dato simulato.** Se una fonte dati fallisce, il sistema mostra l'errore e si ferma. Non vengono mai generati dati fittizi (tranne i demo data chiaramente etichettati `is_demo: true`).

### 5. Auto-miglioramento

- **Parametri modificabili solo entro limiti.** Il sistema può aggiustare parametri delle strategie, ma MAI:
  - Modificare `RiskLimits`
  - Impostare `liveTradingEnabled` a true
  - Aggiungere strategie a `allowedStrategiesJson`
  - Aggiungere broker a `allowedBrokersJson`
  - Modificare capitali allocati

## Cosa fare in caso di anomalia

1. Se il kill switch si attiva, non disattivarlo senza aver capito la causa
2. Se il paper trading si discosta significativamente dal backtest (>20%), sospendere la strategia
3. Se arrivano webhook con token non validi ripetutamente, cambiare il token e verificare chi sta tentando di abusare dell'endpoint
4. Se il modulo live trading è attivo e qualcosa va storto, attivare immediatamente il kill switch

## Checklist per attivazione live trading

- [ ] Almeno 3-4 settimane di paper trading stabile
- [ ] Backtest IS/OOS superato (Sharpe > 0.5, drawdown < 30%, ≥30 trade OOS)
- [ ] Paper trading allineato al backtest (deviazione < 20%)
- [ ] `liveTradingEnabled` impostato manualmente a true
- [ ] Strategie nella whitelist `allowedStrategiesJson`
- [ ] Broker nella whitelist `allowedBrokersJson`
- [ ] `BrokerConnection.permissionsVerified` = true (solo trading, mai withdrawal)
- [ ] Kill switch e circuit breaker attivi
- [ ] Capitale allocato al live trading minimo e separato
- [ ] Notifiche Telegram configurate per eventi critici