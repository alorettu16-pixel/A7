-- Simulazione: raggruppa per asset e calcola se un trailing stop avrebbe salvato le perdite
-- Calcola lo SL come ATR(14) * 1.5 sul prezzo di entrata invece dello SL fisso %
-- Per ora facciamo analisi asset buoni

-- Asset profittevoli: LINK, DOGE, SOL, AVAX, BNB, DOT, ETH (7 su 10)
-- Asset perdenti: BTC, XRP, ADA

-- PnL solo asset profittevoli
SELECT 'SOLO ASSET BUONI' as scenario;
SELECT ROUND(SUM(total_pnl),2) as pnl FROM (
  SELECT SUM(realized_pnl) as total_pnl FROM paper_trades WHERE status='closed' AND asset IN ('LINK','DOGE','SOL','AVAX','BNB','DOT','ETH')
);

-- PnL asset esclusi
SELECT 'SOLO ASSET CATTIVI' as scenario;
SELECT ROUND(SUM(realized_pnl),2) as pnl FROM paper_trades WHERE status='closed' AND asset IN ('BTC','XRP','ADA');

-- PnL totale
SELECT 'TOTALE REALE (9 ASSET)' as scenario;
SELECT ROUND(SUM(realized_pnl),2) as pnl FROM paper_trades WHERE status='closed';

-- Trailing stop simulation: quante perdite sono sotto -5% su posizioni LONG?
-- Se avessimo usato trailing stop ATR-based, le perdite grosse sarebbero state evitate
SELECT 'PERDITE > -10$ per asset' as scenario;
SELECT asset, COUNT(*) as count, ROUND(SUM(realized_pnl),2) as total_loss
FROM paper_trades 
WHERE status='closed' AND realized_pnl < -10 
GROUP BY asset
ORDER BY total_loss ASC;