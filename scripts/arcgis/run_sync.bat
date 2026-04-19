@echo off
REM Wrapper để chạy daily_sync.py bằng ArcGIS Pro Python (có arcpy)
REM Double-click file này để sync tay. Task Scheduler cũng gọi file này.

chcp 65001 >nul 2>&1
TITLE PowerMind Daily Sync
COLOR 0A
cd /d "%~dp0"

set PROPY=C:\Program Files\ArcGIS\Pro\bin\Python\scripts\propy.bat
if not exist "%PROPY%" (
    echo ❌ Khong tim thay ArcGIS Pro Python tai:
    echo    %PROPY%
    echo.
    echo Kiem tra ArcGIS Pro da cai dat va duong dan chuan.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   POWERMIND DAILY SYNC — Chay qua ArcGIS Pro Python
echo ============================================================
echo.

"%PROPY%" "%~dp0daily_sync.py"
set CODE=%ERRORLEVEL%

echo.
if %CODE% EQU 0 (
    echo ✅ Sync hoan tat
) else (
    echo ❌ Sync loi - xem log o tren
)
pause
exit /b %CODE%
