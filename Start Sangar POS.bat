@echo off
chcp 65001 >nul
title سیستەمی سەنگەر زمارەیی و جێگر زمارەیی - Sangar ^& Jegr Zmarayi POS

echo ======================================================================
echo          سیستەمی فرۆشتن و کۆگای سەنگەر زمارەیی و جێگر زمارەیی
echo              Sangar ^& Jegr Zmarayi - Truck Parts POS System
echo                        100%% OFFLINE WINDOWS POS
echo ======================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR / هەڵە] Node.js نەدۆزرایەوە لەسەر ئەم کۆمپیوتەرە!
    echo تکایە سەرەتا Node.js دابمەزرێنە لە: https://nodejs.org
    echo پاشان دووبارە ئەم فایلە بکەرەوە.
    echo.
    pause
    exit /b 1
)

:: 2. Ensure data, backups, and logs folders exist
if not exist "data" mkdir "data"
if not exist "backups" mkdir "backups"
if not exist "logs" mkdir "logs"

:: 3. Set Environment variables
set PORT=3000
set NODE_ENV=production

:: 4. Check if server is already running on port 3000
powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] سێرڤەر پێشتر کاردەکات! کردنەوەی وێبگەڕ...
    start http://localhost:3000
    exit /b 0
)

echo [INFO] دەستپێکردنی سێرڤەری خۆجێیی و بنکەی زانیاری (data\shop.db)...
echo [INFO] تۆماری چالاکییەکان لە: logs\server.log
echo.

:: 5. Launch Node.js server once in background
start "Sangar-Jegr-POS-Server" /min cmd /c "node server.js >> logs\server.log 2>&1"

:: 6. Wait for health check up to 10 seconds
echo [INFO] چاوەڕوانی ئامادەبوونی سیستەم...
set /a attempts=0
:WAIT_HEALTH
timeout /t 1 /nobreak >nul
set /a attempts+=1
powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 1; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 goto SERVER_READY
if %attempts% lss 10 goto WAIT_HEALTH

:SERVER_READY
echo [INFO] سیستەم بە سەرکەوتوویی ئامادە کرا!
echo [INFO] کردنەوەی ڕووکاری سیستەم لە وێبگەڕ...
start http://localhost:3000

echo.
echo ======================================================================
echo   سیستەم بە سەرکەوتوویی لەسەر ئەم لاپتۆپە دەستیپێکرد!
echo   پەڕەی فرۆشتن لەناو وێبگەڕ (Chrome / Edge) کرایەوە.
echo   ناونیشانی سیستەم: http://localhost:3000
echo ======================================================================
echo.
timeout /t 3 /nobreak >nul
exit /b 0
