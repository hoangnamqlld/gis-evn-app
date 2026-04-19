@echo off
title Luoi Dien - Cap nhat du lieu hang thang
color 0A
echo ============================================
echo   Cap nhat du lieu luoi dien - Hang thang
echo ============================================
echo.
echo Dang convert GDB moi sang GeoJSON...
cd automation
python auto-deploy.py
cd ..
echo.
echo Cap nhat xong! Backend tu dong reload du lieu.
echo Nguoi dung refresh browser la thay du lieu moi.
pause
