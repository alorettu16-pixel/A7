"use client";

import { Shield, Activity, BarChart3, Zap, Receipt, BookOpen, Sliders, FileText, Calendar, HelpCircle, TrendingUp, LayoutGrid, DollarSign, Timer, Target, RefreshCw, Power, Wallet } from "lucide-react";

const sections = [
  {
    id: "panoramica",
    title: "Panoramica",
    icon: Activity,
    content: [
      "La dashboard principale mostra lo stato in tempo reale del sistema: budget demo, PnL realizzato e non realizzato, numero di strategie attive, posizioni aperte, segnali e webhook della giornata. I dati si aggiornano automaticamente ogni 10 secondi.",
      "Nella parte superiore trovi le KPI card: Budget Demo (capitale iniziale virtuale), Disponibili (budget + profitti realizzati), Strategie Attive, Posizioni Aperte, Segnali Oggi. Sotto, la sezione Performance mostra il dettaglio realizzato/non realizzato, Win Rate, Commissioni totali e lo stato del Live Trading.",
      "La sezione Mercati mostra un grafico a candele inline per ogni asset monitorato (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, DOT) con variazione nelle 24h. Le posizioni aperte sono elencate con entry price, PnL corrente, dimensione, timer di scadenza e barre di progresso SL/TP."
    ]
  },
  {
    id: "strategie",
    title: "Libreria Strategie",
    icon: LayoutGrid,
    content: [
      "Qui trovi tutte le strategie di trading caricate nel sistema. Ogni strategia ha un nome, categoria (momentum, mean reversion), fonte (Ricerca Web, Builder, Webhook) e stato (paper_active, research, rejected, ecc.).",
      "Ogni strategia ha un pulsante ON/OFF per attivarla o disattivarla. Le strategie attive (paper_active) generano segnali a ogni ciclo; quelle disattivate (research) sono inattive ma rimangono nella libreria per eventuale riattivazione. Le strategie attive appaiono in cima con una barra laterale verde.",
      "I dettagli interni di ogni strategia (parametri MACD, RSI, soglie, logica di ingresso) non sono esposti — fanno parte del know-how proprietario del sistema."
    ]
  },
  {
    id: "builder",
    title: "Strategy Builder",
    icon: TrendingUp,
    content: [
      "Pagina per creare manualmente nuove strategie da inserire nel sistema. Puoi definire nome, categoria, regole di entrata e uscita, parametri SL/TP. La strategia viene salvata con stato 'research' e può essere attivata dalla Libreria Strategie."
    ]
  },
  {
    id: "segnali",
    title: "Segnali Live",
    icon: Zap,
    content: [
      "Mostra in tempo reale i segnali generati dal sistema. Ogni segnale include asset, direzione (LONG/SHORT), prezzo d'ingresso, strategia che lo ha generato, livello di confidenza e data/ora. I segnali vengono generati ogni ciclo su timeframe 4h per tutti gli asset monitorati.",
      "Il generatore di segnali applica automaticamente: filtro di trend EMA200 (blocca LONG in downtrend e SHORT in uptrend), controllo esposizione massima, e limite di posizioni aperte per asset (una per strategia)."
    ]
  },
  {
    id: "paper-trades",
    title: "Paper Trades",
    icon: Receipt,
    content: [
      "Elenco completo di tutte le operazioni di paper trading eseguite dal sistema. Ogni trade mostra: ID, asset, direzione, prezzo d'entrata, prezzo corrente, dimensione della posizione, PnL realizzato/non realizzato, strategia, data di apertura e chiusura.",
      "I trade aperti sono evidenziati con barre di progresso SL/TP e timer di scadenza (48h massime). I trade chiusi mostrano il PnL finale e il motivo di chiusura (stop_loss, take_profit, trend_exit, trailing_stop, time_exit).",
      "Dalla dashboard principale, la card Posizioni Aperte mostra anche il badge di sizing (importo fisso o percentuale) e il conto alla rovescia per la scadenza."
    ]
  },
  {
    id: "diario",
    title: "Diario Decisioni",
    icon: BookOpen,
    content: [
      "Registro cronologico di tutte le decisioni prese dal sistema: apertura trade, chiusura trade, modifice ai parametri, segnali di blocco. Ogni voce include la strategia coinvolta, il motivo della decisione e il PnL risultante."
    ]
  },
  {
    id: "performance",
    title: "Performance",
    icon: BarChart3,
    content: [
      "Pagina dedicata all'analisi delle prestazioni del sistema. Mostra: equity curve (andamento del capitale nel tempo), distribuzione dei PnL per trade, win rate per strategia e per asset, drawdown massimo, profit factor. I dati vengono aggiornati a ogni ciclo.",
      "Le metriche chiave includono: numero totale di trade chiusi, win rate percentuale, profit factor (gross profit / gross loss), average win/loss, max consecutive wins/losses, e rendimento percentuale sul budget iniziale."
    ]
  },
  {
    id: "regole",
    title: "Regole & Parametri",
    icon: Sliders,
    content: [
      "Panello di controllo per visualizzare e modificare i parametri delle strategie attive. Qui puoi regolare: SL e TP percentuali, timeframe di riferimennto, asset su cui operare, e altri parametri operativi. Le modifice vengono applicate al ciclo successivo."
    ]
  },
  {
    id: "rischio",
    title: "Rischio & Esecuzione",
    icon: Shield,
    content: [
      "Pagina di controllo centrale per la gestione del rischio. Tutte le impostazioni salvate qui sono permanenti e persistono tra i cicli.",
      "Sezioni disponibili:",
      "• Budget Demo — capitale virtuale per il paper trading (default 10.000$)",
      "• Dimensione Operazione — scegli tra Importo Fisso (es.100$ a trade) o Percentuale Budget (% del capitale totale). I trade gia' aperti continuano con la vecchia impostazione, solo i nuovi usano quella corrente.",
      "• Limiti di Rischio — Max Drawdown Giornaliero (blocca i trade se superato), Max Posizione (dimensione massima per singolo trade), Esposizione Massima (capitale totale impegnato contemporaneamente), Leva Massima (moltiplicatore di esposizione).",
      "• Kill Switch — si attiva automaticamente se il drawdown giornaliero supera la soglia. Blocca l'apertura di nuovi trade fino a sblocco manuale.",
      "• Whitelist — strategie e broker autorizzati al live trading (modificabile solo da database)."
    ]
  },
  {
    id: "report",
    title: "Report",
    icon: FileText,
    content: [
      "Genera report periodici sullo stato del sistema: riepilogo giornaliero con numero di trade, PnL del giorno, win rate, strategie attive, e alert di deviazione. I report vengono inviati automaticamente su Telegram se configurato."
    ]
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: Calendar,
    content: [
      "Calendario delle attività passate e future del sistema: cicli di backtest, generazione segnali, report programmati. Mostra anche lo storico dei kill switch attivati e le modifiche ai limiti di rischio."
    ]
  }
];

export default function ComeFunzionaPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-bold text-2xl">A7</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Come funziona A7</h1>
            <p className="text-[#94a3b8] text-sm mt-1">
              Piattaforma di trading multi-strategia ideata e realizzata da <strong className="text-white">Alessandro Lorettu</strong>
            </p>
          </div>
        </div>
        <p className="text-[#94a3b8] leading-relaxed">
          A7 è un sistema automatico di paper trading che ricerca, seleziona, testa ed esegue strategie di trading su
          mercati crypto (Bybit USDT perpetual). Tutto è automatizzato — dal caricamento delle candele alla generazione
          dei segnali, dall'apertura dei trade alla chiusura con SL/TP dinamici. Di seguito, una guida completa a ogni
          pagina del sistema.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Icon size={20} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white">{section.title}</h2>
              </div>
              <div className="space-y-4">
                {section.content.map((paragraph, i) => (
                  <p key={i} className="text-[#94a3b8] text-sm leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 glass-card p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet size={18} className="text-green-400" />
          <span className="text-white font-semibold">Paper Trading</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <p className="text-[#94a3b8] text-sm">
          Al momento il sistema opera esclusivamente in modalità paper trading. I trade sono simulati con dati di mercato
          reali (Bybit) ma nessun capitale reale è a rischio. Il passaggio al live trading richiede configurazione
          manuale delle API key e abilitazione esplicita.
        </p>
        <p className="text-[#64748b] text-xs mt-4">
          A7 v0.1.0 · Sviluppato da Alessandro Lorettu · © 2026
        </p>
      </div>
    </div>
  );
}