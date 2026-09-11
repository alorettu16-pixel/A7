-- Aggiorna tutte le strategie paper_active a timeExitHours=24
UPDATE strategies SET 
  parameters_json = json_set(parameters_json, '$.timeExitHours', 24)
WHERE status = 'paper_active';

SELECT id, name, json_extract(parameters_json, '$.timeExitHours') as timeExit FROM strategies WHERE status = 'paper_active' ORDER BY id;