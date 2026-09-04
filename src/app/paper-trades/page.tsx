"use client";
import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Timer, XCircle, Filter, ArrowDown, ArrowUp, Calendar } from "lucide-react";

interface TradeData {
  id: number; strategyId: number; asset: string; side: string;
  entryPrice: number; currentPrice: number; simulatedPositionSize: number;
  feesApplied: number; slippageApplied: number;
  unrealizedPnl: number; realizedPnl: number; status: string;
  openedAt: string; closedAt: string | null;
  strategyName: string;
  pnlCurve: { time: string; pnl: number }[];
  timeExitHours?: number;
}

const ALL_ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT"];

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
  if (remaining <= 0) return <span className="text-red-400 font-medium text-xs">SCADUTA</span>;
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

export default function PaperTradesPage() {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterAsset, setFilterAsset] = useState("");
  const [filterSide, setFilterSide] = useState("");
  const [sortBy, setSortBy] = useState("pnl");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSortDir = () => setSortDir(d => d === "desc" ? "asc" : "desc");

  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set("sort", sortBy);
    params.set("dir", sortDir);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterDate) params.set("date", filterDate);
    if (filterAsset) params.set("asset", filterAsset);
    if (filterSide) params.set("side", filterSide);
    return `/api/trades?${params.toString()}`;
  };

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(buildUrl());
      setTrades(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
    const iv = setInterval(fetchTrades, 30000);
    return () => clearInterval(iv);
  }, [filterStatus, filterDate, filterAsset, filterSide, sortBy, sortDir]);

  if (loading && trades.length === 0) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status === "closed");
  const totalPnl = trades.reduce((s, t) => s + (t.realizedPnl || 0) + (t.unrealizedPnl || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Paper Trades</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{trades.length} mostrati &middot; {openTrades.length} aperti &middot; PnL {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}$</p>
      </div>

      <div className="glass-card p-3 mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Filter size={14} className="text-indigo-400" />
        <span className="text-[#64748b] text-xs">Filtri:</span>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1a1a3e] text-white border border-[#2a2a5e] rounded px-2 py-1 text-xs">
          <option value="all">Tutti</option>
          <option value="open">Aperti</option>
          <option value="closed">Chiusi</option>
        </select>
        <div className="flex items-center gap-1">
          <Calendar size={12} className="text-[#64748b]" />
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="bg-[#1a1a3e] text-white border border-[#2a2a5e] rounded px-2 py-1 text-xs w-32" />
          {filterDate && (
            <button onClick={() => setFilterDate("")} className="text-[#64748b] hover:text-white text-xs px-1">&times;</button>
          )}
        </div>
        <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)}
          className="bg-[#1a1a3e] text-white border border-[#2a2a5e] rounded px-2 py-1 text-xs">
          <option value="">Tutti asset</option>
          {ALL_ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterSide} onChange={e => setFilterSide(e.target.value)}
          className="bg-[#1a1a3e] text-white border border-[#2a2a5e] rounded px-2 py-1 text-xs">
          <option value="">Tutte direzioni</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <span className="text-[#64748b] text-xs ml-2">Ordina:</span>
        <div className="flex items-center gap-1">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-[#1a1a3e] text-white border border-[#2a2a5e] rounded px-2 py-1 text-xs">
            <option value="pnl">PnL</option>
            <option value="date">Data</option>
            <option value="asset">Asset</option>
          </select>
          <button onClick={toggleSortDir}
            className="bg-[#1a1a3e] text-white border border-[#2a2a5e] rounded px-2 py-1 hover:bg-[#2a2a5e] transition-colors">
            {sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
          </button>
        </div>
        <button onClick={fetchTrades}
          className="ml-auto flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          <RefreshCw size={12} /> Aggiorna
        </button>
      </div>

      {filterStatus !== "closed" && openTrades.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Posizioni Aperte ({openTrades.length})</h2>
          <div className="grid gap-3">
            {openTrades.map(t => {
              const pnl = (t.unrealizedPnl || 0);
              const pnlClass = pnl > 0 ? "border-green-500/40 bg-green-500/5" : pnl < 0 ? "border-red-500/40 bg-red-500/5" : "border-gray-500/20";
              const pnlPct = t.entryPrice > 0 ? (t.side === "long" ? (t.currentPrice - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - t.currentPrice) / t.entryPrice * 100) : 0;
              const slPct = (t as any).slPct ?? 2;
              const tpPct = (t as any).tpPct ?? 4;
              const distToSL = slPct + pnlPct;
              const distToTP = tpPct - pnlPct;
              const toSLbar = Math.max(0, Math.min(100, ((slPct - distToSL) / slPct) * 100));
              const toTPbar = Math.max(0, Math.min(100, (pnlPct / tpPct) * 100));
              return (
                <div key={t.id} className={`glass-card p-4 border-l-4 ${pnlClass} animate-slide-in`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {t.side === "long" ? <TrendingUp className="text-green-400" size={20} /> : <TrendingDown className="text-red-400" size={20} />}
                      <span className="text-white font-semibold">{t.asset}</span>
                      <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                      <span className="text-[#64748b] text-xs">#{t.id}</span>
                    </div>
                    <span className={`font-bold text-lg ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}$ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm text-[#94a3b8]">
                    <div>Entry: <span className="text-white">${t.entryPrice.toFixed(2)}</span></div>
                    <div>Corrente: <span className="text-white">${t.currentPrice.toFixed(2)}</span></div>
                    <div>Size: <span className="text-white">${t.simulatedPositionSize.toFixed(2)}</span></div>
                    <div>
                      <CountdownTimer
                        endMs={new Date(t.openedAt).getTime() + ((t as any).timeExitHours ?? 96) * 60 * 60 * 1000}
                        maxHours={(t as any).timeExitHours ?? 96}
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-red-400">SL {slPct}%</span>
                        <span className="text-[#64748b]">{distToSL > 0 ? distToSL.toFixed(2) + "%" : "\u26D4"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-500/60 transition-all duration-1000" style={{ width: `${toSLbar}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-green-400">TP {tpPct}%</span>
                        <span className="text-[#64748b]">{distToTP > 0 ? distToTP.toFixed(2) + "%" : "\u2705"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500/60 transition-all duration-1000" style={{ width: `${toTPbar}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-[#64748b] mt-2">Aperto: {new Date(t.openedAt).toLocaleString()} {t.strategyName}</div>
                  <button
                    onClick={async () => {
                      if (!confirm("Chiudere manualmente il trade #" + t.id + "?")) return;
                      try {
                        await fetch("/api/trades/" + t.id + "/close", { method: "POST" });
                        fetchTrades();
                      } catch {}
                    }}
                    className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <XCircle size={12} />
                    Chiudi manualmente
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filterStatus !== "open" && closedTrades.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">
            Trade Conclusi ({closedTrades.length})
            {filterDate && <span className="text-[#64748b] text-sm font-normal ml-2"> {filterDate}</span>}
          </h2>
          <div className="space-y-2">
            {closedTrades.map(t => {
              const pnl = t.realizedPnl || 0;
              const pnlPct = t.entryPrice > 0 ? (t.side === "long" ? (t.currentPrice - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - t.currentPrice) / t.entryPrice * 100) : 0;
              const emoji = pnl > 5 ? "\uD83D\uDFE2" : pnl > 0 ? "\u2705" : pnl === 0 ? "\u26AA" : pnl > -5 ? "\uD83D\uDD34" : "\uD83D\uDC80";
              return (
                <div key={t.id} className="glass-card p-3 text-sm animate-slide-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Activity size={14} className="text-gray-400" />
                      <span className="text-white">{t.asset}</span>
                      <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                      <span className="text-[#94a3b8]">#{t.id}</span>
                    </div>
                    <span className={`font-medium ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {emoji} {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}$ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="text-xs text-[#64748b] mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Entry ${t.entryPrice.toFixed(2)}</span>
                    <span>Exit ${t.currentPrice.toFixed(2)}</span>
                    <span>Size ${t.simulatedPositionSize.toFixed(2)}</span>
                    <span>{t.strategyName}</span>
                    <span>{new Date(t.openedAt).toLocaleDateString()} {t.closedAt ? new Date(t.closedAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trades.length === 0 && (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <Activity size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessun paper trade ancora.</p>
          <p className="text-sm mt-1">Esegui <code className="text-indigo-400">npm run signals:generate</code> per generare i primi segnali o invia un webhook di test.</p>
        </div>
      )}
    </div>
  );
}

      