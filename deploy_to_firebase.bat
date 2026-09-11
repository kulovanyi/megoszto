@echo off
title Kolcsonadlak.hu - Feltoltes Google Firebase Hostingra
cls
echo ========================================================
echo   KOLCSONADLAK.HU - FELTOLTES GOOGLE FIREBASE HOSTINGRA
echo   Projekt: kolcsonadlak-7212a
echo ========================================================
echo.

:: Node.js es npm eleresi ut hozzaadasa a PATH-hoz
set "NODEJS_PATH=C:\Program Files\nodejs"
set "NPM_PATH=%APPDATA%\npm"
set "PATH=%NODEJS_PATH%;%NPM_PATH%;%PATH%"

:: Projekt mappaba lepunk
cd /d "%~dp0"

:: Ellenorizzuk, hogy a firebase.cmd elerheto-e
where firebase.cmd >nul 2>&1
if errorlevel 1 (
    echo [HIBA] A firebase CLI nem talalhato!
    echo.
    echo Telepitsd a kovetkezo paranccsal (futtasd Admin CMD-ben):
    echo   npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

echo [OK] Firebase CLI megtalalhato.
echo.

:: Bejelentkezes ellenorzese (ha mar be vagy jelentkezve, atugrik)
echo 1. Google fiok bejelentkezes ellenorzese...
call firebase.cmd login
if errorlevel 1 (
    echo [HIBA] A bejelentkezes sikertelen. Probald ujra!
    pause
    exit /b 1
)

echo.
echo 2. Weboldal feltoltese a Google Firebase Hostingra...
call firebase.cmd deploy --only hosting --project kolcsonadlak-7212a
if errorlevel 1 (
    echo.
    echo [HIBA] A feltoltes nem sikerult!
    echo Ellenorizd a firebase.json fajlt es a halozati kapcsolatot.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   SIKERESEN ELESEDETT A WEBHELY A FIREBASE-EN!
echo   1. https://kolcsonadlak-7212a.web.app
echo   2. https://kolcsonadlak-7212a.firebaseapp.com
echo ========================================================
echo.
start https://kolcsonadlak-7212a.web.app
pause
