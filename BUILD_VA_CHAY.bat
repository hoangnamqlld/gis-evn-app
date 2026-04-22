@echo off
TITLE PowerMind - Build Data + Chay App
COLOR 0A
cd /d "%~dp0"

echo ======================================================
echo    POWERMIND - BUILD DU LIEU + CHAY UNG DUNG
echo ======================================================
echo.

echo [1/4] Build tile (chia GeoJSON thanh tile gzip)...
python scripts\build_tiles.py
if errorlevel 1 (
  echo.
  echo ERROR: build_tiles.py that bai. Dung lai.
  pause
  exit /b 1
)
echo.

echo [2/4] Build relations (4 bang JOIN: TBA-KH, trụ-KH, graph dây)...
python scripts\build_relations.py
if errorlevel 1 (
  echo.
  echo ERROR: build_relations.py that bai. Dung lai.
  pause
  exit /b 1
)
echo.

echo [3/4] Build frontend (vite production bundle)...
cd thuthaptoado
call npm install --silent
call npx vite build
if errorlevel 1 (
  echo.
  echo ERROR: vite build that bai. Dung lai.
  pause
  exit /b 1
)
echo.

echo [4/4] Khoi dong vite preview server (localhost:4173)...
echo Mo trinh duyet: http://localhost:4173
echo Nhan Ctrl+C de dung server.
echo.
start "" "http://localhost:4173"
call npx vite preview --host --port 4173
