"use client";

import { useEffect, useState } from "react";
import {
  Play, Loader2, CheckCircle, XCircle, RefreshCw,
  TrendingUp, TrendingDown, Activity, DollarSign, BarChart3,
  FileText, Shield, ArrowUpRight, ArrowDownRight, Wallet,
  Zap, Target, Timer, AlertTriangle
} from "lucide-react";

// ─── Countdown Timer ────────────────────────────────────────────────────────
function CountdownTimer({ endMs, maxHours }: { endMs: number; maxHours: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const remaining = Math.max(0, endMs - now);
  const total = maxHours * 60 * 60 * 1000;
  const elapsed = total - remaining;
  const pct = Math.min(100, (elapsed / total) * 100);

  if (remaining <= 0) {
    return <span className="text-red-400 font-medium text-xs">SCADUTA</span>;
  }

  const h = Math.floor(remaining / (1000 * 60 * 60));
  const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((remaining % (1000 * 60)) / 1000);

  const color = h < 12 ? "text-red-400" : h < 24 ? "text-yellow-400" : "text-[#94a3b8]";

  return (
    <div className="flex items-center gap-1.5">
      <Timer size={10} className={color} />
      <span className={`font-mono text-xs ${color}`}>
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      <div className="w-10 h-1 bg-[#1e1e3a] rounded-full overflow-hidden ml-1">
        <div className={`h-full rounded-full transition-all duration-1000 ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Componente grafico a candele inline ──────────────────────────────────
function CandleChart() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/candles");
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchData();
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="text-center text-[#64748b] text-sm py-4">Caricamento mercati...</div>;
  if (!data) return <div className="text-center text-[#64748b] text-sm py-4">Nessun dato mercato</div>;

  const assets = Object.entries(data) as [string, any][];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {assets.map(([asset, info]) => {
        if (info.error || !info.candles || info.candles.length === 0) return null;
        const isGreen = info.change24 >= 0;
        const candleW = 100 / info.candles.length;
        const height = 60;

        return (
          <div key={asset} className="bg-[#0a0a1a] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-semibold text-sm">{asset}</span>
              <span className={`text-xs font-medium ${isGreen ? "text-green-400" : "text-red-400"}`}>
                ${info.price.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#64748b] mb-2">
              <span>H ${info.high24?.toFixed(2)}</span>
              <span>L ${info.low24?.toFixed(2)}</span>
              <span className={isGreen ? "text-green-400" : "text-red-400"}>{isGreen ? "+" : ""}{info.change24}%</span>
            </div>
            {/* Candele SVG inline */}
            <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} className="overflow-visible">
              {info.candles.map((c: any, i: number) => {
                const x = i * candleW + candleW * 0.1;
                const w = candleW * 0.6;
                const color = c.isUp ? "#22c55e" : "#ef4444";
                // Wick
                const topWick = (1 - c.nh) * height;
                const bottomWick = (1 - c.nl) * height;
                // Body
                const bodyTop = (1 - Math.max(c.no, c.nc)) * height;
                const bodyBot = (1 - Math.min(c.no, c.nc)) * height;
                const bodyH = Math.max(bodyBot - bodyTop, 1);

                return (
                  <g key={i}>
                    <line x1={x + w/2} y1={topWick} x2={x + w/2} y2={bottomWick} stroke={color} strokeWidth={0.5} />
                    <rect x={x} y={bodyTop} width={w} height={bodyH} fill={color} rx={0.5} />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

type StepId = "seed" | "backtest" | "signals" | "pnl" | "report" | "webhook";

interface Step {
  id: StepId;
  label: string;
  status: "pending" | "running" | "done" | "error";
  log?: string;
}

interface TradeData {
  id: number; strategyId: number; asset: string; side: string;
  entryPrice: number; currentPrice: number; simulatedPositionSize: number;
  feesApplied: number; slippageApplied: number;
  unrealizedPnl: number; realizedPnl: number; status: string;
  openedAt: string; closedAt: string | null;
  strategyName: string;
  pnlCurve: { time: string; pnl: number }[];
}

interface OverviewData {
  hasStrategies: boolean;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  activeStrategies: number;
  openPositions: number;
  signalsToday: number;
  webhooksToday: number;
  liveTradingEnabled: boolean;
  budgetDemo: number;
  avgDeviation: number;
  equityCurve: { time: string; equity: number }[];
}

export default function HomePage() {
  const [started, setStarted] = useState(false);
  const [needSetup, setNeedSetup] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<Step[]>([
    { id: "seed", label: "Caricamento strategie built-in", status: "pending" },
    { id: "backtest", label: "Backtest su BTC/ETH 15m/1h/4h", status: "pending" },
    { id: "signals", label: "Generazione segnali live su BTC 15m", status: "pending" },
    { id: "pnl", label: "Aggiornamento PnL paper trading", status: "pending" },
    { id: "report", label: "Report giornaliero", status: "pending" },
    { id: "webhook", label: "Test webhook TradingView", status: "pending" },
  ]);
  const [allDone, setAllDone] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [openTrades, setOpenTrades] = useState<TradeData[]>([]);
  const [closedTrades, setClosedTrades] = useState<TradeData[]>([]);
  const [marketData, setMarketData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Auto-refresh overview + trades ogni 10s (era 30s)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ovRes, trRes, candleRes] = await Promise.all([
          fetch("/api/overview"),
          fetch("/api/trades"),
          fetch("/api/candles"),
        ]);
        setOverview(await ovRes.json());
        const allTrades: TradeData[] = await trRes.json();
        setOpenTrades(allTrades.filter(t => t.status === "open"));
        setClosedTrades(allTrades.filter(t => t.status === "closed"));
        setMarketData(await candleRes.json());
        setLastUpdate(new Date().toLocaleTimeString("it-IT"));
      } catch {}
    };
    fetchAll();
    const iv = setInterval(fetchAll, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetch("/api/overview").then(r => r.json()).then(data => {
      setOverview(data);
      setNeedSetup(!data.hasStrategies);
    }).catch(() => setNeedSetup(true));
  }, []);

  const updateStep = (id: StepId, status: Step["status"], log?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, log } : s));
  };

  const run = async () => {
    setStarted(true);
    setAllDone(false);
    const cmdList: StepId[] = ["seed", "backtest", "signals", "pnl", "report", "webhook"];

    for (const id of cmdList) {
      updateStep(id, "running");
      try {
        const r = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: id }),
        });
        const d = await r.json();
        await new Promise(r => setTimeout(r, 500));
        updateStep(id, d.ok ? "done" : "error", d.output?.slice(0, 200));
      } catch {
        updateStep(id, "error", "Errore connessione");
      }
    }

    try {
      const [ovRes, trRes] = await Promise.all([
        fetch("/api/overview"),
        fetch("/api/trades"),
      ]);
      setOverview(await ovRes.json());
      const allTrades: TradeData[] = await trRes.json();
      setOpenTrades(allTrades.filter(t => t.status === "open"));
      setClosedTrades(allTrades.filter(t => t.status === "closed"));
    } catch {}
    setAllDone(true);
  };

  // --- Welcome screen (first time) ---
  if (needSetup && !started) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
            <span className="text-white font-bold text-4xl">A7</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">A7</h1>
        <p className="text-xl text-[#94a3b8] max-w-xl leading-relaxed">
          La piattaforma di trading multi-agente ideata e realizzata da <strong className="text-white">Alessandro Lorettu</strong>
        </p>
        <p className="text-sm text-[#64748b] mt-4 max-w-md">
          Ricerca, backtest, paper trading e integrazione TradingView in un unico sistema.
          <br />Clicca <strong>Avvia</strong> per il ciclo completo di setup e prime esecuzioni.
        </p>
        <button
          onClick={run}
          className="mt-10 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-10 py-4 rounded-xl flex items-center gap-3 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 text-lg"
        >
          <Play size={22} />
          Avvia
        </button>
      </div>
    );
  }

  // --- Setup in progress ---
  if (started && !allDone) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Esecuzione in corso...</h2>
          <div className="space-y-3">
            {steps.map(step => (
              <div key={step.id} className={`glass-card p-3 flex items-center gap-3 transition-all ${
                step.status === "running" ? "border-indigo-500/40 animate-pulse-glow" :
                step.status === "done" ? "border-green-500/30" :
                step.status === "error" ? "border-red-500/30" : ""
              }`}>
                {step.status === "pending" && <div className="w-5 h-5 rounded-full border-2 border-[#1e1e3a]" />}
                {step.status === "running" && <Loader2 size={20} className="text-indigo-400 animate-spin shrink-0" />}
                {step.status === "done" && <CheckCircle size={20} className="text-green-400 shrink-0" />}
                {step.status === "error" && <XCircle size={20} className="text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium">{step.label}</div>
                  {step.log && <div className="text-xs text-[#64748b] truncate mt-0.5">{step.log}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  const o = overview || {
    totalPnl: 0, realizedPnl: 0, unrealizedPnl: 0,
    activeStrategies: 0, openPositions: 0, signalsToday: 0,
    webhooksToday: 0, liveTradingEnabled: false, budgetDemo: 500,
    avgDeviation: 0, equityCurve: [],
  };
  // Se overview non è ancora caricata, mostra loading
  if (!overview) {
    return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;
  }

  const totalPnl = o.totalPnl;
  const pnlPct = o.budgetDemo > 0 ? (totalPnl / o.budgetDemo) * 100 : 0;
  const isGreen = totalPnl >= 0;
  const winCount = (o as any).winCount || 0;
  const lossCount = (o as any).lossCount || 0;
  const winRate = (o as any).winRate || 0;
  const totalClosed = (o as any).totalClosed || closedTrades.length;
  const totalFees = closedTrades.reduce((s, t) => s + (t.feesApplied || 0), 0) + openTrades.reduce((s, t) => s + (t.feesApplied || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Panoramica</h1>
          <p className="text-[#94a3b8] text-sm mt-1">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            <span className="ml-2 text-indigo-400">· Aggiornamento ogni 10s</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748b]">
          <RefreshCw size={12} className="animate-spin" />
          Live {lastUpdate && <span className="text-indigo-400">{lastUpdate}</span>}
        </div>
      </div>

      {/* KPI Cards — prima riga: saldo + statistiche chiave */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Budget Demo + PnL */}
        <div className="glass-card p-5 md:col-span-1">
          <div className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Budget Demo</div>
          <div className="text-3xl font-bold text-white">${o.budgetDemo.toLocaleString()}</div>
          <div className={`flex items-center gap-1.5 mt-2 ${isGreen ? "text-green-400" : "text-red-400"}`}>
            {isGreen ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="font-semibold">{isGreen ? "+" : ""}{totalPnl.toFixed(2)}$</span>
            <span className="text-xs opacity-70">({isGreen ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
          </div>
        </div>

        {/* Strategie Attive */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <BarChart3 size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{o.activeStrategies}</div>
              <div className="text-xs text-[#64748b]">Strategie Attive</div>
            </div>
          </div>
          <div className="text-[10px] text-[#64748b] uppercase tracking-wider">
            <span className="text-green-400">18 paper_active</span> · <span className="text-yellow-400">1 watch</span>
          </div>
        </div>

        {/* Posizioni Aperte */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Activity size={18} className="text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{o.openPositions}</div>
              <div className="text-xs text-[#64748b]">Posizioni Aperte</div>
            </div>
          </div>
          <div className="text-[10px] text-[#64748b] uppercase tracking-wider">
            <span className="text-green-400">{winCount} win</span> · <span className="text-red-400">{lossCount} loss</span> · <span className="text-[#64748b]">{closedTrades.length} chiusi</span>
          </div>
        </div>

        {/* Segnali & Webhook */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Zap size={18} className="text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{o.signalsToday}</div>
              <div className="text-xs text-[#64748b]">Segnali Oggi</div>
            </div>
          </div>
          <div className="text-[10px] text-[#64748b] uppercase tracking-wider">
            <span className="text-yellow-400">{o.webhooksToday} webhook</span> · <span className="text-gray-400">{(o.signalsToday + o.webhooksToday) > 0 ? "attivo" : "nessuna attività"}</span>
          </div>
        </div>
      </div>

      {/* Seconda riga: Performance + Win Rate + Fee + Live Trading Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Performance</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#94a3b8]">Realizzato</span>
              <span className={o.realizedPnl >= 0 ? "text-green-400" : "text-red-400"}>{o.realizedPnl >= 0 ? "+" : ""}{o.realizedPnl.toFixed(2)}$</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94a3b8]">Non realizzato</span>
              <span className={o.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>{o.unrealizedPnl >= 0 ? "+" : ""}{o.unrealizedPnl.toFixed(2)}$</span>
            </div>
            <div className="flex justify-between border-t border-[#1e1e3a] pt-2">
              <span className="text-[#94a3b8]">Totale</span>
              <span className={`font-semibold ${isGreen ? "text-green-400" : "text-red-400"}`}>{isGreen ? "+" : ""}{totalPnl.toFixed(2)}$</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Win Rate</div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full border-2 border-green-500/30 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{winRate.toFixed(0)}%</span>
            </div>
            <div className="text-sm">
              <div className="text-green-400">{winCount} vittorie</div>
              <div className="text-red-400">{lossCount} perdite</div>
              <div className="text-[#64748b]">{totalClosed} totali chiusi</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Commissioni</div>
          <div className="text-2xl font-bold text-white">${totalFees.toFixed(2)}</div>
          <div className="text-xs text-[#64748b] mt-1">Entry + Exit (0.1% per trade)</div>
        </div>

        <div className="glass-card p-4">
          <div className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Live Trading</div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${o.liveTradingEnabled ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
            <span className={`font-semibold ${o.liveTradingEnabled ? "text-green-400" : "text-red-400"}`}>
              {o.liveTradingEnabled ? "ATTIVO" : "DISABILITATO"}
            </span>
          </div>
          <div className="text-xs text-[#64748b] mt-1">Paper trading attivo</div>
        </div>
      </div>

      {/* ─── GRAFICI A CANDELE — 10 asset ───────────────────────────────── */}

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-400" />
            Mercati — 24h
          </h2>
          <span className="text-xs text-[#64748b]">Aggiornamento ogni 60s</span>
        </div>
        <CandleChart />
      </div>

      {/* Posizioni Aperte — card live con dati reali */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Activity size={18} className="text-indigo-400" />
            Posizioni Aperte ({o.openPositions})
          </h2>
          <a href="/paper-trades" className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1">
            Vedi tutte →
          </a>
        </div>

        {openTrades.length === 0 ? (
          <div className="text-center py-8">
            <Activity size={32} className="mx-auto mb-2 text-[#64748b] opacity-30" />
            <p className="text-sm text-[#64748b]">Nessuna posizione aperta al momento.</p>
            <p className="text-xs text-[#64748b] mt-1">I segnali vengono generati ogni 10 minuti su BTC e ETH 15m.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openTrades.slice(0, 6).map(t => {
              const pnl = (t.unrealizedPnl || 0);
              const pnlClass = pnl > 0 ? "border-l-green-500/40 bg-green-500/5" : pnl < 0 ? "border-l-red-500/40 bg-red-500/5" : "border-l-gray-500/20";
              const pnlPct = t.entryPrice > 0
                ? (t.side === "long" ? (t.currentPrice - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - t.currentPrice) / t.entryPrice * 100)
                : 0;
              const maxHours = (t as any).timeExitHours ?? 96;
              const openedMs = new Date(t.openedAt).getTime();
              const endMs = openedMs + maxHours * 60 * 60 * 1000;

              // SL/TP distances
              const slPct = (t as any).slPct ?? 2;
              const tpPct = (t as any).tpPct ?? 4;
              const distToSL = slPct + pnlPct; // quanto manca allo SL in %
              const distToTP = tpPct - pnlPct; // quanto manca al TP in %
              const toSLbar = Math.max(0, Math.min(100, ((slPct - distToSL) / slPct) * 100));
              const toTPbar = Math.max(0, Math.min(100, (pnlPct / tpPct) * 100));

              return (
                <div key={t.id} className={`border-l-4 ${pnlClass} bg-[#0a0a1a] rounded-lg p-4 transition-all hover:bg-[#0f0f25]`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.side === "long" ? "bg-green-500/15" : "bg-red-500/15"}`}>
                        {t.side === "long"
                          ? <ArrowUpRight size={16} className="text-green-400" />
                          : <ArrowDownRight size={16} className="text-red-400" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{t.asset}</span>
                          <span className={`text-xs font-medium ${t.side === "long" ? "text-green-400" : "text-red-400"}`}>{t.side.toUpperCase()}</span>
                          <span className="text-[#64748b] text-xs">#{t.id}</span>
                        </div>
                        <div className="text-[10px] text-[#64748b]">{t.strategyName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-base ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}$
                      </div>
                      <div className={`text-xs ${pnl >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                        {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-xs text-[#94a3b8]">
                    <div>Entry: <span className="text-white">${t.entryPrice.toFixed(2)}</span></div>
                    <div>Corrente: <span className="text-white">${t.currentPrice.toFixed(2)}</span></div>
                    <div>Size: <span className="text-white">${t.simulatedPositionSize.toFixed(2)}</span></div>
                    <div>
                      <CountdownTimer endMs={endMs} maxHours={maxHours} />
                    </div>
                  </div>
                  {/* SL/TP Progress Bars */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-red-400">SL {slPct}%</span>
                        <span className="text-[#64748b]">{distToSL > 0 ? distToSL.toFixed(2) + "%" : "⛔"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500/60 transition-all duration-1000"
                          style={{ width: `${toSLbar}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-green-400">TP {tpPct}%</span>
                        <span className="text-[#64748b]">{distToTP > 0 ? distToTP.toFixed(2) + "%" : "✅"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500/60 transition-all duration-1000"
                          style={{ width: `${toTPbar}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {openTrades.length > 6 && (
              <div className="text-center pt-2">
                <a href="/paper-trades" className="text-indigo-400 hover:text-indigo-300 text-sm">
                  +{openTrades.length - 6} altre posizioni aperte →
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trade Chiusi Recenti (ultimi 5) */}
      {closedTrades.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Target size={16} className="text-green-400" />
              Trade Chiusi Recenti
            </h2>
            <a href="/paper-trades" className="text-indigo-400 hover:text-indigo-300 text-sm">Vedi tutti →</a>
          </div>
          <div className="space-y-2">
            {closedTrades.slice(0, 5).map(t => (
              <div key={t.id} className="bg-[#0a0a1a] rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${(t.realizedPnl || 0) >= 0 ? "bg-green-500/15" : "bg-red-500/15"}`}>
                    {(t.realizedPnl || 0) >= 0
                      ? <ArrowUpRight size={12} className="text-green-400" />
                      : <ArrowDownRight size={12} className="text-red-400" />
                    }
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">{t.asset} <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span> <span className="text-[#64748b]">#{t.id}</span></div>
                    <div className="text-[10px] text-[#64748b]">{t.strategyName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${(t.realizedPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(t.realizedPnl || 0) >= 0 ? "+" : ""}{(t.realizedPnl || 0).toFixed(2)}$
                  </div>
                  <div className="text-[10px] text-[#64748b]">
                    {t.closedAt ? new Date(t.closedAt).toLocaleDateString("it-IT") : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="/strategie" className="glass-card p-3 text-center hover:border-indigo-500/40 transition-colors">
          <BarChart3 size={18} className="mx-auto text-indigo-400 mb-1" />
          <div className="text-white text-sm font-medium">Strategie</div>
          <div className="text-[#64748b] text-xs">{o.activeStrategies} attive</div>
        </a>
        <a href="/performance" className="glass-card p-3 text-center hover:border-indigo-500/40 transition-colors">
          <TrendingUp size={18} className="mx-auto text-green-400 mb-1" />
          <div className="text-white text-sm font-medium">Performance</div>
          <div className="text-[#64748b] text-xs">Backtest & PnL</div>
        </a>
        <a href="/segnali" className="glass-card p-3 text-center hover:border-indigo-500/40 transition-colors">
          <Zap size={18} className="mx-auto text-yellow-400 mb-1" />
          <div className="text-white text-sm font-medium">Segnali</div>
          <div className="text-[#64748b] text-xs">{o.signalsToday} oggi</div>
        </a>
        <a href="/report" className="glass-card p-3 text-center hover:border-indigo-500/40 transition-colors">
          <FileText size={18} className="mx-auto text-blue-400 mb-1" />
          <div className="text-white text-sm font-medium">Report</div>
          <div className="text-[#64748b] text-xs">Giornaliero</div>
        </a>
      </div>
    </div>
  );
}