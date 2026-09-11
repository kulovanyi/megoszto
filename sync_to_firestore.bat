@echo off
title Kolcsonadlak.hu - Firestore Adatbazis Szinkronizalas
cls
echo ========================================================
echo   KOLCSONADLAK.HU - CLOUD FIRESTORE SZINKRONIZALAS
echo   Projekt: kolcsonadlak-7212a
echo ========================================================
echo.

cd /d "%~dp0"
python seed_firestore.py

echo.
pause
