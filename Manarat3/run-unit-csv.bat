@echo off
REM Script to automate Node.js installation, install npm dependencies,
REM and run `node unit-csv.js` twice using `call` for safety.

REM Prevent unexpected exits
setlocal enabledelayedexpansion

REM Change directory to where the script was executed
cd /d %~dp0

REM Check if Node.js is installed
echo Checking for Node.js...
call node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Attempting to install Node.js...

    REM Detect System Architecture
    set ARCH=x64
    for /f "tokens=2 delims==" %%A in ('wmic os get osarchitecture /value ^| find "="') do (
        if /I "%%A"=="32-bit" set ARCH=x86
    )

    REM Set Node.js Download URL
    set "NODEJS_URL=https://nodejs.org/dist/v20.8.0/node-v20.8.0-win-%ARCH%.msi"

    REM Download Node.js Installer
    echo Downloading Node.js from %NODEJS_URL%...
    call powershell -Command "Invoke-WebRequest -Uri '%NODEJS_URL%' -OutFile 'nodejs.msi'" >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to download Node.js. Please check your internet connection.
        pause
        exit /b 1
    )

    REM Install Node.js Silently
    echo Installing Node.js...
    call msiexec /i nodejs.msi /quiet /norestart >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install Node.js. Please try installing it manually.
        del /f nodejs.msi
        pause
        exit /b 1
    )
    del /f nodejs.msi
    echo Node.js installed successfully.

    REM Verify npm Installation
    call npm -v >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm is not available after Node.js installation. Please check the installation.
        pause
        exit /b 1
    )
)

REM Install npm dependencies
echo Installing npm dependencies...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies. Please check your package.json file.
    pause
    exit /b 1
)
echo npm install completed successfully.

REM RUN UNIT-CSV.JS TWICE
echo Running unit-csv.js (1st time)...
call node unit-csv.js
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Script execution failed on first run. 
    pause
    exit /b 1
)

echo Running unit-csv.js (2nd time)...
call node unit-csv.js
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Script execution failed on second run.
    pause
    exit /b 1
)

REM Success
echo Script executed successfully (twice). Check tower-floorplate.log for output.

REM Keep the window open
echo Press any key to exit...
pause
