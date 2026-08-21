"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Shield, Save, DollarSign, Sliders } from "lucide-react";

interface RiskData {
  id: number | null;
  liveTradingEnabled: boolean;
  maxDailyDrawdownPct: number;
  maxPositionSizeUsd: number;
  maxTotalExposureUsd: number;
  maxLeverageAllowed: number;
  demoBudgetUsd: number;
  allowedStrategies: string[];
  allowedBrokers: string[];
  killSwitchActive: boolean;
  globalSizingMode: string;
  globalSizingValue: number;
}

export default function RischioPage() {
  const [limits, setLimits] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/risk").then(r => r.json()).then(setLimits).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!limits) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/risk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDailyDrawdownPct: limits.maxDailyDrawdownPct,
          maxPositionSizeUsd: limits.maxPositionSizeUsd,
          maxTotalExposureUsd: limits.maxTotalExposureUsd,
          maxLeverageAllowed: limits.maxLeverageAllowed,
          demoBudgetUsd: limits.demoBudgetUsd,
          globalSizingMode: limits.globalSizingMode,
          globalSizingValue: limits.globalSizingValue,
        }),
      });
      const d = await res.json();
      setSaved(d.ok);
    } catch {}
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Rischio & Esecuzione Reale</h1>
        <p className="text-[#94a3b8] text-sm mt-1">Limiti di rischio, budget demo e stato modulo live trading</p>
      </div>

      {/* Stato live trading */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-4 h-4 rounded-full ${limits?.liveTradingEnabled ? "bg-red-500 animate-blink" : "bg-gray-500"}`} />
          <span className="text-white font-semibold">Live Trading: {limits?.liveTradingEnabled ? "ATTIVO" : "DISABILITATO"}</span>
          <span className="text-xs text-[#64748b] ml-2">(Modificabile solo dal database, non dal sistema automatico)</span>
        </div>
      </div>

      {/* Budget Demo */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-green-400" />
          <h2 className="text-white font-semibold">Budget Demo</h2>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={limits?.demoBudgetUsd ?? 10000}
            onChange={e => setLimits(prev => prev ? { ...prev, demoBudgetUsd: Number(e.target.value) } : prev)}
            className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-4 py-2 text-white text-lg font-bold w-40 focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-[#94a3b8]">$ — capitale virtuale per il paper trading</span>
        </div>
      </div>

      {/* Sizing Mode — Fixed / Percent */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={18} className="text-purple-400" />
          <h2 className="text-white font-semibold">Dimensione Operazione</h2>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => setLimits(prev => prev ? { ...prev, globalSizingMode: "fixed" } : prev)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              limits?.globalSizingMode === "fixed"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-[#1e1e3a] text-[#64748b] hover:bg-[#2a2a4a]"
            }`}
          >
            Importo Fisso
          </button>
          <button
            onClick={() => setLimits(prev => prev ? { ...prev, globalSizingMode: "percent" } : prev)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              limits?.globalSizingMode === "percent"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "bg-[#1e1e3a] text-[#64748b] hover:bg-[#2a2a4a]"
            }`}
          >
            Percentuale Budget
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            step={limits?.globalSizingMode === "percent" ? "0.5" : "10"}
            value={limits?.globalSizingValue ?? 100}
            onChange={e => setLimits(prev => prev ? { ...prev, globalSizingValue: Number(e.target.value) } : prev)}
            className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm w-24 focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-[#94a3b8] text-sm">
            {limits?.globalSizingMode === "percent" ? "% del budget totale per operazione" : "$ per operazione"}
          </span>
        </div>
        <div className="mt-3 text-xs text-[#64748b] bg-[#0a0a1a] rounded-lg p-3">
          <strong className="text-indigo-300">Nota:</strong> I trade attualmente aperti continuano con la dimensione al momento dell'apertura. Solo i <strong>nuovi</strong> trade useranno questa impostazione.
        </div>
      </div>

      {/* Risk limits editabili */}
      <div className="glass-card p-4 mb-4">
        <h2 className="text-white font-semibold mb-4">Limiti di Rischio</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[#64748b] text-xs mb-1">Max Drawdown Giornaliero</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={limits?.maxDailyDrawdownPct ?? 10}
                onChange={e => setLimits(prev => prev ? { ...prev, maxDailyDrawdownPct: Number(e.target.value) } : prev)}
                className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm w-20 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[#94a3b8] text-sm">%</span>
            </div>
          </div>
          <div>
            <div className="text-[#64748b] text-xs mb-1">Max Posizione</div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] text-sm">$</span>
              <input
                type="number"
                value={limits?.maxPositionSizeUsd ?? 100}
                onChange={e => setLimits(prev => prev ? { ...prev, maxPositionSizeUsd: Number(e.target.value) } : prev)}
                className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm w-24 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <div className="text-[#64748b] text-xs mb-1">Esposizione Massima</div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] text-sm">$</span>
              <input
                type="number"
                value={limits?.maxTotalExposureUsd ?? 500}
                onChange={e => setLimits(prev => prev ? { ...prev, maxTotalExposureUsd: Number(e.target.value) } : prev)}
                className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm w-24 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <div className="text-[#64748b] text-xs mb-1">Leva Massima</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                value={limits?.maxLeverageAllowed ?? 1}
                onChange={e => setLimits(prev => prev ? { ...prev, maxLeverageAllowed: Number(e.target.value) } : prev)}
                className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm w-20 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-[#94a3b8] text-sm">x</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-5 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
        >
          <Save size={16} />
          {saving ? "Salvataggio..." : "Salva limiti"}
        </button>
        {saved && <span className="text-green-400 text-sm ml-3">✓ Salvato</span>}
      </div>

      {/* Kill switch */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${limits?.killSwitchActive ? "bg-red-500" : "bg-green-500"}`} />
          <span className="text-white font-semibold">Kill Switch: {limits?.killSwitchActive ? "ATTIVO" : "DISATTIVO"}</span>
        </div>
        <div className="text-xs text-[#64748b] mt-1">
          {limits?.killSwitchActive ? "Blocco automatico nuovi ordini attivo (drawdown giornaliero superato)" : "Nessuna soglia di drawdown superata — kill switch inattivo"}
        </div>
      </div>

      {/* Whitelist */}
      <div className="glass-card p-4 mb-4">
        <h2 className="text-white font-semibold mb-2">Whitelist</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#0a0a1a] rounded-lg p-3">
            <div className="text-[#64748b] text-xs mb-1">Strategie autorizzate al live trading</div>
            <div className="text-white font-semibold">{limits?.allowedStrategies?.length || 0}</div>
            <div className="text-[#64748b] text-xs mt-1">(Modificabile solo da database)</div>
          </div>
          <div className="bg-[#0a0a1a] rounded-lg p-3">
            <div className="text-[#64748b] text-xs mb-1">Broker autorizzati</div>
            <div className="text-white font-semibold">{limits?.allowedBrokers?.length || 0}</div>
            <div className="text-[#64748b] text-xs mt-1">(Modificabile solo da database)</div>
          </div>
        </div>
      </div>

      {/* Note sicurezza */}
      <div className="glass-card p-4 text-sm text-[#64748b]">
        <Shield size={16} className="inline mr-1" />
        I limiti di rischio come <strong>liveTradingEnabled</strong>, <strong>allowedStrategies</strong> e <strong>allowedBrokers</strong> sono modificabili solo manualmente nel database. Il sistema automatico non può alterarli.
      </div>
    </div>
  );
}