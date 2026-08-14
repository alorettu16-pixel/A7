"use client";

import { useState } from "react";
import { Play, RefreshCw } from "lucide-react";

export default function BuilderPage() {
  const [name, setName] = useState("");
  const [indicator, setIndicator] = useState("ma_crossover");
  const [condition, setCondition] = useState("crosses_above");
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(30);
  const [slPct, setSlPct] = useState(5);
  const [tpPct, setTpPct] = useState(10);
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entryRulesText = `{
  indicator: "${indicator}",
  params: { fastPeriod: ${fastPeriod}, slowPeriod: ${slowPeriod} },
  condition: "${condition}",
  target: 0
}`;

  const exitRulesText = `SL: ${slPct}%, TP: ${tpPct}%`;

  const handleBuild = async () => {
    if (!name.trim()) {
      setError("Inserisci un nome per la strategia");
      return;
    }

    setBuilding(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: "custom",
          entryRules: [{
            indicator,
            params: { fastPeriod, slowPeriod },
            condition,
            target: 0,
          }],
          exitRules: [
            { type: "sl", params: { pct: slPct } },
            { type: "tp", params: { pct: tpPct } },
          ],
          parameters: { fastPeriod, slowPeriod, slPct, tpPct },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`Strategia "${name}" creata! ID: ${data.id}`);
      } else {
        setError(data.error || "Errore durante la creazione");
      }
    } catch (err) {
      setError("Errore di connessione");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Strategy Builder</h1>
        <p className="text-[#94a3b8] text-sm mt-1">Crea una nuova strategia senza scrivere codice</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Builder Form */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Configurazione</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Nome Strategia</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                placeholder="Es. Mia EMA Crossover"
              />
            </div>

            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Indicatore</label>
              <select
                value={indicator}
                onChange={(e) => setIndicator(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
              >
                <option value="ma_crossover">Media Mobile Crossover</option>
                <option value="rsi">RSI</option>
                <option value="macd">MACD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Condizione</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
              >
                <option value="crosses_above">Incrocia sopra</option>
                <option value="crosses_below">Incrocia sotto</option>
                <option value="above">Sopra</option>
                <option value="below">Sotto</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Periodo Rapido</label>
                <input
                  type="number"
                  value={fastPeriod}
                  onChange={(e) => setFastPeriod(Number(e.target.value))}
                  className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Periodo Lento</label>
                <input
                  type="number"
                  value={slowPeriod}
                  onChange={(e) => setSlowPeriod(Number(e.target.value))}
                  className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Stop Loss %</label>
                <input
                  type="number"
                  value={slPct}
                  onChange={(e) => setSlPct(Number(e.target.value))}
                  className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Take Profit %</label>
                <input
                  type="number"
                  value={tpPct}
                  onChange={(e) => setTpPct(Number(e.target.value))}
                  className="w-full bg-[#0a0a1a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleBuild}
              disabled={building}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors"
            >
              {building ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Creazione...</>
              ) : (
                <><Play className="w-4 h-4" /> Crea Strategia</>
              )}
            </button>

            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            {result && (
              <div className="text-green-400 text-sm">{result}</div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Anteprima Regole</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm text-[#94a3b8] mb-2">Regole di Entrata</h3>
              <pre className="bg-[#0a0a1a] rounded-lg p-3 text-sm text-green-400 font-mono">
                {entryRulesText}
              </pre>
            </div>
            <div>
              <h3 className="text-sm text-[#94a3b8] mb-2">Regole di Uscita</h3>
              <pre className="bg-[#0a0a1a] rounded-lg p-3 text-sm text-red-400 font-mono">
                {exitRulesText}
              </pre>
            </div>
            <div className="text-sm text-[#94a3b8]">
              <p>In parole semplici: entra long quando l'EMA rapida ({fastPeriod}) incrocia sopra l'EMA lenta ({slowPeriod}). Esci con stop loss al {slPct}% o take profit al {tpPct}%.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}