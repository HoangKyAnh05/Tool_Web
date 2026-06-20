@echo off
title Push DevBlueprint AI to GitHub
color 0B

echo ===================================================
echo             PUSH TO GITHUB REPOSITORY
echo ===================================================
echo.
echo Remote URL: https://github.com/HoangKyAnh05/Tool_Web.git
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    echo Please install Git and try again.
    pause
    exit /b
)

:: Clean and re-initialize Git repository to purge any historical secrets from commit logs
echo [INFO] Cleaning local Git history to purge blocked secrets...
rd /s /q .git >nul 2>nul
echo [INFO] Initializing fresh Git repository...
git init

:: Set remote origin
git remote add origin https://github.com/HoangKyAnh05/Tool_Web.git

:: Stage files
echo [INFO] Adding files to Git (excluding ignored files)...
git add .

:: Commit
echo [INFO] Committing changes...
git commit -m "feat: complete DevBlueprint AI app with Gemini 2.5, auto-retry, desktop shortcut, and project history feature"

:: Set branch name to main
git branch -M main

:: Push
echo [INFO] Pushing to GitHub (main branch)...
git push -u origin main --force

echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Code pushed to GitHub successfully!
) else (
    echo [WARNING] There was an issue pushing to GitHub.
    echo Please make sure your repository is empty or check your credentials/network.
)
echo.
pause
