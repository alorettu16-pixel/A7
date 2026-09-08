-- Disabilita strategie SHORT paper_active → research
UPDATE strategies SET status = 'research' WHERE status = 'paper_active' AND (
  name LIKE '%SHORT%'
);

-- Verifica risultato
SELECT id, name, status FROM strategies WHERE name LIKE '%SHORT%';