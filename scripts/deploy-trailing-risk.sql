-- Aumenta posizione size a 125$ per far spazio ai top 4 asset
UPDATE risk_limits SET max_position_size_usd=125, updated_at=datetime('now') WHERE id=1;

-- Aggiunge trailing stop alle strategie per SOL e AVAX (asset volatili)
-- Le strategie interessate sono quelle con nome contenente "SOL" o "AVAX"
UPDATE strategies SET
  parameters_json = json_set(
    parameters_json,
    '$.trailingActivatePct', 2.0,
    '$.trailingDistancePct', 0.8
  )
WHERE status='paper_active' AND (name LIKE '%SOL%' OR name LIKE '%AVAX%');

-- Verifica
SELECT id, name, 
  json_extract(parameters_json, '$.trailingActivatePct') as trail_activate,
  json_extract(parameters_json, '$.trailingDistancePct') as trail_distance,
  json_extract(parameters_json, '$.timeExitHours') as timeExit,
  json_extract(parameters_json, '$.sl') as sl
FROM strategies WHERE status='paper_active' ORDER BY id;

SELECT 'RISK LIMITS' as info;
SELECT max_position_size_usd, max_total_exposure_usd FROM risk_limits WHERE id=1;