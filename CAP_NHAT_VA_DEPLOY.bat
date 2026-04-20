@echo off
REM ============================================================
REM PowerMind - Cap Nhat Du Lieu & Deploy len Cloud
REM ASCII-only, khong emoji, khong ky tu dac biet
REM ============================================================

setlocal
TITLE PowerMind - Cap Nhat Du Lieu
COLOR 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo    POWERMIND - CAP NHAT DU LIEU + DEPLOY CLOUD
echo  ============================================================
echo.
echo  Quy trinh tu dong:
echo    1. Xuat GeoJSON tu Geodatabase
echo    2. Chia tile va build search index
echo    3. Commit va push len GitHub
echo    4. GitHub Actions tu build + deploy Cloudflare Pages
echo    5. 100 user mo app se thay du lieu moi
echo.
echo  Thoi gian du kien: 3-5 phut local + 5-7 phut CI/CD
echo.
pause

REM -- KIEM TRA PYTHON + GIT ---------------------------------
echo.
echo [0/4] Kiem tra moi truong...
where python >nul 2>&1
if errorlevel 1 (
    echo   LOI: Python chua cai. Tai tu https://www.python.org/downloads/
    pause
    exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
    echo   LOI: Git chua cai. Tai tu https://git-scm.com/
    pause
    exit /b 1
)
echo   OK: Python + Git san sang

REM -- BUOC 1: XUAT GEOJSON TU GDB ---------------------------
echo.
echo  ============================================================
echo   [1/4] XUAT GEOJSON TU GEODATABASE
echo  ============================================================
if not exist "Dulieugismoi\luoi-dien-app\automation\auto-deploy.py" (
    echo   Canh bao: Khong tim thay auto-deploy.py - BO QUA buoc 1
) else (
    cd /d "%~dp0Dulieugismoi\luoi-dien-app\automation"
    python auto-deploy.py
    if errorlevel 1 (
        echo   LOI: auto-deploy.py that bai
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo   OK: GeoJSON xuat xong
)

REM -- BUOC 2: BUILD TILE ------------------------------------
echo.
echo  ============================================================
echo   [2/4] CHIA TILE + BUILD SEARCH INDEX
echo  ============================================================
python scripts\build_tiles.py
if errorlevel 1 (
    echo   LOI: build_tiles.py that bai
    pause
    exit /b 1
)
echo   OK: Tile va search index xong

REM -- BUOC 3: COMMIT -----------------------------------------
echo.
echo  ============================================================
echo   [3/4] COMMIT CHANGES
echo  ============================================================

REM Lay timestamp
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set dt=%%i
set today=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%
set now=%dt:~8,2%:%dt:~10,2%

REM Stage files
git add Dulieugismoi/luoi-dien-app/automation/output/*.geojson 2>nul
git add thuthaptoado/public/data/manifest.json 2>nul
git add -A 2>nul

git diff --cached --quiet
if errorlevel 1 (
    echo   Co thay doi, dang commit...
    git commit -m "Update GIS data %today% %now%"
    if errorlevel 1 (
        echo   LOI: Commit that bai
        pause
        exit /b 1
    )
    echo   OK: Commit xong
) else (
    echo   Khong co thay doi de commit
)

REM -- BUOC 4: PUSH -------------------------------------------
echo.
echo  ============================================================
echo   [4/4] PUSH LEN GITHUB
echo  ============================================================
git push
if errorlevel 1 (
    echo.
    echo   LOI: Push that bai. Co the do:
    echo      - Chua dang nhap GitHub. Chay: gh auth login
    echo      - Conflict voi remote. Chay: git pull --rebase
    echo      - Mat ket noi mang
    pause
    exit /b 1
)

REM -- HOAN THANH ---------------------------------------------
echo.
echo  ============================================================
echo    HOAN THANH!
echo  ============================================================
echo.
echo   OK: Code da push len GitHub
echo   OK: GitHub Actions dang build + deploy
echo.
echo   5-7 phut nua se co tai:
echo      - Actions: https://github.com/hoangnamqlld/gis-evn-app/actions
echo      - App:     https://gis-evn-app.pages.dev
echo      - 100 user mo app se thay banner "Co du lieu moi"
echo.
echo   Dang mo Actions de theo doi...
start "" "https://github.com/hoangnamqlld/gis-evn-app/actions"
echo.
pause
endlocal
exit /b 0
