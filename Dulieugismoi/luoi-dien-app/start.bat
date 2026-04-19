@echo off
title Luoi Dien App - Startup
color 0B
echo ============================================
echo   Luoi Dien App - Khoi dong ung dung
echo ============================================
echo.

REM Buoc 1: Tao du lieu (neu chua co)
if not exist "automation\output\luoi-dien.geojson" (
    echo [1/3] Tao du lieu GeoJSON...
    cd automation
    python auto-deploy.py
    cd ..
    echo.
) else (
    echo [1/3] Du lieu san co: automation\output\luoi-dien.geojson
)

REM Buoc 2: Khoi dong Backend
echo [2/3] Khoi dong Backend (port 3001)...
cd backend
if not exist "node_modules" (
    echo Cai dat dependencies...
    npm install
)
start "Backend - Port 3001" cmd /k "npm start"
cd ..
timeout /t 3 /nobreak >nul

REM Buoc 3: Khoi dong Frontend
echo [3/3] Khoi dong Frontend (port 3000)...
cd frontend
if not exist "node_modules" (
    echo Cai dat dependencies...
    npm install
)
start "Frontend - Port 3000" cmd /k "npm start"
cd ..

echo.
echo ============================================
echo   Ung dung dang khoi dong...
echo   Mo browser: http://localhost:3000
echo ============================================
timeout /t 5 /nobreak >nul
start http://localhost:3000
