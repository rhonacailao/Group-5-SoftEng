
@echo off
setlocal

REM Go to the project root directory
cd /d "%~dp0.."

REM Select the migration operation
if /I "%~1"=="preview" goto preview
if /I "%~1"=="apply" goto apply

echo HOPE ERP - Database Migration Runner
echo.
echo Usage:
echo   migrate.cmd preview
echo   migrate.cmd apply
exit /b 0

:preview
echo Checking pending database migrations...
call npx.cmd supabase db push --linked --dry-run
exit /b %errorlevel%

:apply
echo WARNING: This will modify the linked database.
echo Only continue after team approval.
choice /C YN /M "Proceed with migration"

if errorlevel 2 exit /b 1

call npx.cmd supabase db push --linked
exit /b %errorlevel%
