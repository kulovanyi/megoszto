@echo off
title Kolcsonadlak.hu - Feltoltes Sybell Tarhelyre
cls
echo ========================================================
echo       KOLCSONADLAK.HU - FELTOLTES SYBELL TARHELYRE
echo ========================================================
echo.
echo Automatikus FTP szinkronizacio inditasa...
echo.
python deploy_sybell.py
echo.
echo ========================================================
pause
