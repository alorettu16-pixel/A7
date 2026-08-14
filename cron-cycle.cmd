@echo off
REM A7 Trading Cycle - eseguito dal Task Scheduler ogni 3 minuti
cd /d C:\Users\alore\CryptoHermes\a7
C:\Users\alore\AppData\Roaming\nvm\nodejs\tsx src\scripts\update-pnl.ts >> C:\Users\alore\CryptoHermes\a7\cron.log 2>&1
