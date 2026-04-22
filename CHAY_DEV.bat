@echo off
TITLE PowerMind - Dev Mode (hot reload)
COLOR 0B
cd /d "%~dp0thuthaptoado"

echo ======================================================
echo    POWERMIND - CHE DO DEV (hot reload)
echo ======================================================
echo.
echo Yeu cau: du lieu da duoc build san trong public\data
echo (chay BUILD_VA_CHAY.bat truoc neu chua co)
echo.
echo Mo trinh duyet: http://localhost:5173
echo Nhan Ctrl+C de dung server.
echo.
call npm install --silent
start "" "http://localhost:5173"
call npx vite --host
