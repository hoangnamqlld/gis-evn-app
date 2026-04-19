@echo off
REM ============================================================
REM PowerMind - Deploy nhanh (chi push code, KHONG cap nhat data)
REM Dung khi chi sua giao dien/tinh nang, GIS khong thay doi
REM ============================================================

chcp 65001 >nul 2>&1
TITLE PowerMind - Deploy nhanh
COLOR 0B
cd /d "%~dp0"

echo.
echo  ============================================================
echo   ⚡ DEPLOY NHANH (chi push code len GitHub)
echo  ============================================================
echo.

REM Status check
git status --short
echo.
set /p CONFIRM="Commit + push cac thay doi tren? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Da huy.
    pause
    exit /b 0
)

set /p MSG="Nhap commit message (Enter de dung mac dinh): "
if "%MSG%"=="" set MSG=chore: update

git add -A
git commit -m "%MSG%"
git push
if errorlevel 1 (
    echo ❌ Push fail
    pause
    exit /b 1
)

echo.
echo ✓ Push xong. Mo Actions de xem tien do...
start "" "https://github.com/hoangnamqlld/gis-evn-app/actions"
pause
