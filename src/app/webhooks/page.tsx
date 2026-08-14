"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Webhook } from "lucide-react";

interface WebhookLog {
  id: number;
  receivedAt: string;
  ticker: string | null;
  action: string | null;
  price: number | null;
  tokenValid: boolean;
  schemaValid: boolean;
  isDuplicate: boolean;
  rejectionReason: string | null;
}

export default function WebhooksPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/webhooks")
      .then(r => r.json())
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;
  }

  const webhookUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/api/webhooks/tradingview` 
    : "http://localhost:3000/api/webhooks/tradingview";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Webhook TradingView</h1>
        <p className="text-[#94a3b8] text-sm mt-1">Monitoraggio segnali ricevuti da TradingView</p>
      </div>

      {/* Webhook URL */}
      <div className="glass-card p-4 mb-6">
        <h2 className="text-sm font-semibold text-[#94a3b8] mb-2">Endpoint Webhook</h2>
        <div className="bg-[#0a0a1a] rounded-lg p-3 text-sm font-mono text-green-400 break-all">
          {webhookUrl}?token=...
        </div>
        <p className="text-xs text-[#64748b] mt-2">
          Configura questo URL nel tuo alert TradingView. Il token è nel file .env.
        </p>
      </div>

      {/* Log */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-[#94a3b8] mb-4">Log Segnali ({logs.length})</h2>
        
        {logs.length === 0 ? (
          <p className="text-[#64748b] text-sm">Nessun segnale ricevuto. Invia un webhook di test con: npm run webhook:test</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const statusIcon = log.isDuplicate ? "🔄" : !log.tokenValid ? "🔴" : !log.schemaValid ? "🟡" : "🟢";
              const statusColor = log.isDuplicate ? "text-yellow-400" : !log.tokenValid ? "text-red-400" : !log.schemaValid ? "text-yellow-400" : "text-green-400";

              return (
                <div key={log.id} className="bg-[#0a0a1a] rounded-lg p-3 text-sm animate-slide-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={statusColor}>{statusIcon}</span>
                      <span className="text-white font-mono">{log.ticker || "—"}</span>
                      <span className="text-[#94a3b8]">{log.action || "—"}</span>
                      {log.price && <span className="text-[#94a3b8]">@ {log.price.toFixed(2)}$</span>}
                    </div>
                    <span className="text-[#64748b] text-xs">{new Date(log.receivedAt).toLocaleTimeString()}</span>
                  </div>
                  {log.rejectionReason && (
                    <div className="text-red-400 text-xs mt-1">{log.rejectionReason}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}