@echo off
REM Pinboard launcher for Windows
REM Usage: pinboard [command]

if "%1"=="" goto dev
if "%1"=="install" goto install
if "%1"=="update" goto install
if "%1"=="help" goto help
if "%1"=="--help" goto help
echo Unknown command: %1

:help
echo Pinboard -- local ticket-based workspace for opencode
echo.
echo Usage: pinboard [command]
echo.
echo Commands:
echo   install     Install Pinboard (run pinboard-install binary instead)
echo   update      Pull latest version and rebuild
echo   (no args)   Start the development server
echo.
goto end

:install
echo Run the installer binary: pinboard-install
echo Or: bun install ^& bun run build ^& bun run db:migrate
goto end

:dev
bun run dev
goto end

:end
