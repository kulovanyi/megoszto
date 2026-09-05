@echo off
title Megoszto.hu - Feltoltes GitHub-ra
cls
echo ========================================================
echo       MEGOSZTO.HU - FELTOLTES GITHUB-RA
echo ========================================================
echo.
echo 1. Aktualis valtozasok lekerdezese...
git status -s
echo.
echo --------------------------------------------------------
set /p COMMIT_MSG="Adj meg egy rovid uzenetet (vagy nyomj ENTER-t): "
if "%COMMIT_MSG%"=="" (
    set COMMIT_MSG=Frissites: %DATE% %TIME%
)

echo.
echo 2. Fajlok hozzaadasa (git add .)...
git add .

echo.
echo 3. Valtozasok mentese (git commit)...
git commit -m "%COMMIT_MSG%"

echo.
echo 4. Feltoltes a GitHub-ra (git push origin main)...
git push origin main

echo.
echo ========================================================
if %ERRORLEVEL% EQU 0 (
    echo [SIKER] A legfrissebb verzio fent van a GitHub-on!
    echo Repo: https://github.com/kulovanyi/megoszto
    echo Weboldal: https://kulovanyi.github.io/megoszto/
) else (
    echo [FIGYELEM] Hiba lepett fel a feltoltesnel.
)
echo ========================================================
echo.
pause
