@echo off
cd /d C:\Users\alore\CryptoHermes\a7

echo ========================================
echo   A7 — Avvio completo
echo ========================================
echo.

:: 1. Avvia il server dev in background
echo [1/4] Avvio server Next.js...
start /B cmd /c "npm run dev > a7-server.log 2>&1"

:: Aspetta che il server sia pronto
echo       Attendiamo il server...
:wait
timeout /t 2 /nobreak >nul
curl -s -o nul http://localhost:3000 2>nul
if errorlevel 1 goto wait
echo       Server pronto su http://localhost:3000
echo.

:: 2. Aggiorna PnL delle posizioni aperte
echo [2/4] Aggiornamento PnL...
call npx tsx src/scripts/update-pnl.ts
echo.

:: 3. Genera nuovi segnali
echo [3/4] Generazione segnali...
call npx tsx src/scripts/generate-signals.ts
echo.

:: 4. Aggiorna PnL dopo i nuovi segnali
echo [4/4] Aggiornamento PnL finale...
call npx tsx src/scripts/update-pnl.ts
echo.

echo ========================================
echo   ✅ A7 avviato!
echo   Dashboard: http://localhost:3000
echo ========================================
echo.
echo Processi in esecuzione:
wmic process where "commandline like '%%next dev%%'" get processid,commandline /format:list 2>nul | findstr /i "ProcessId"
echo.
echo Per fermare il server: taskkill /f /im node.exe
