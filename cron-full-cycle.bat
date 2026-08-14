@echo off
cd /d C:\Users\alore\CryptoHermes\a7

:: Controlla se il server è attivo, se no lo avvia
curl -s -o nul http://localhost:3000 2>nul
if errorlevel 1 (
    start /B cmd /c "npm run dev > a7-server.log 2>&1"
    echo Server avviato, attendo...
    :wait
    timeout /t 3 /nobreak >nul
    curl -s -o nul http://localhost:3000 2>nul
    if errorlevel 1 goto wait
)

:: Full cycle
npx tsx src/scripts/generate-signals.ts >> a7-cron.log 2>&1
npx tsx src/scripts/update-pnl.ts >> a7-cron.log 2>&1
npx tsx src/scripts/review-outcomes.ts >> a7-cron.log 2>&1