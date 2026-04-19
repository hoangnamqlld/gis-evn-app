@echo off
REM ============================================================
REM PowerMind - Cap Nhat Du Lieu & Deploy toan bo len Cloud
REM Quy trinh: 1 click duy nhat → 100 user co ban moi sau 5-7 phut
REM ============================================================

chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
TITLE PowerMind - Cap Nhat & Deploy cho 100 User
COLOR 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo   🚀 POWERMIND — CAP NHAT DU LIEU + DEPLOY CLOUD
echo  ============================================================
echo.
echo  Quy trinh tu dong:
echo    1. Xuat GeoJSON tu Geodatabase (auto-deploy.py)
echo    2. Chia tile + build search index (build_tiles.py)
echo    3. Commit code va push len GitHub
echo    4. GitHub Actions tu build + deploy len Cloudflare Pages
echo    5. 100 user mo app = thay banner "Co du lieu moi"
echo.
echo  Thoi gian du kien: 3-5 phut (local) + 5-7 phut (CI/CD)
echo.
pause

REM -- KIEM TRA YEU CAU --------------------------------------
echo.
echo [0/4] 🔍 Kiem tra moi truong...
where python >nul 2>&1
if errorlevel 1 (
    echo   ❌ Python chua cai. Tai: https://www.python.org/downloads/
    pause
    exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
    echo   ❌ Git chua cai. Tai: https://git-scm.com/
    pause
    exit /b 1
)
echo   ✓ Python + Git OK

REM -- BUOC 1: XUAT GEOJSON TU GDB ---------------------------
echo.
echo  ============================================================
echo   [1/4] 📥 XUAT GEOJSON TU GEODATABASE
echo  ============================================================
if not exist "Dulieugismoi\luoi-dien-app\automation\auto-deploy.py" (
    echo   ⚠ Khong tim thay auto-deploy.py - BO QUA buoc 1
    echo   ^(dung neu GeoJSON da co san, khong can re-export^)
) else (
    cd /d "%~dp0Dulieugismoi\luoi-dien-app\automation"
    python auto-deploy.py
    if errorlevel 1 (
        echo   ❌ Loi khi chay auto-deploy.py
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo   ✓ GeoJSON xuat xong
)

REM -- BUOC 2: BUILD TILE ------------------------------------
echo.
echo  ============================================================
echo   [2/4] 🗂️  CHIA TILE + BUILD SEARCH INDEX
echo  ============================================================
python scripts\build_tiles.py
if errorlevel 1 (
    echo   ❌ Loi khi chay build_tiles.py
    pause
    exit /b 1
)
echo   ✓ Tile + search index xong

REM -- BUOC 3: COMMIT -----------------------------------------
echo.
echo  ============================================================
echo   [3/4] 📝 COMMIT CHANGES
echo  ============================================================

REM Lay timestamp Vietnam
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set dt=%%i
set today=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%
set now=%dt:~8,2%:%dt:~10,2%

REM Stage files — chi commit GeoJSON nguon (tile tu dong rebuild tren CI)
git add Dulieugismoi/luoi-dien-app/automation/output/*.geojson 2>nul
git add thuthaptoado/public/data/manifest.json 2>nul
git add -A 2>nul

REM Check xem co thay doi khong
git diff --cached --quiet
if errorlevel 1 (
    echo   Co thay doi, dang commit...
    git commit -m "Update GIS data %today% %now%"
    if errorlevel 1 (
        echo   ❌ Loi khi commit
        pause
        exit /b 1
    )
    echo   ✓ Commit xong
    set NEEDPUSH=1
) else (
    echo   ⚠ Khong co gi de commit ^(du lieu khong doi^)
    echo   Se push code neu local dang co commit chua push...
    set NEEDPUSH=1
)

REM -- BUOC 4: PUSH -------------------------------------------
echo.
echo  ============================================================
echo   [4/4] ☁️  PUSH LEN GITHUB (TRIGGER AUTO-DEPLOY)
echo  ============================================================
git push
if errorlevel 1 (
    echo.
    echo   ❌ Push FAIL. Co the do:
    echo      - Chua dang nhap GitHub ^(chay: gh auth login^)
    echo      - Conflict voi remote ^(chay: git pull --rebase^)
    echo      - Mat mang
    pause
    exit /b 1
)

REM -- HOAN THANH ---------------------------------------------
echo.
echo  ============================================================
echo   🎉 HOAN THANH!
echo  ============================================================
echo.
echo   ✓ Code da push len GitHub
echo   ✓ GitHub Actions dang chay build + deploy
echo   ✓ 5-7 phut sau:
echo        - Kiem tra: https://github.com/hoangnamqlld/gis-evn-app/actions
echo        - App moi:  https://gis-evn-app.pages.dev
echo        - 100 user mo app = thay banner "Co du lieu moi" → bam la xong
echo.
echo   Dang mo Actions de theo doi...
start "" "https://github.com/hoangnamqlld/gis-evn-app/actions"
echo.
pause
endlocal
exit /b 0
