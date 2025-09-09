@echo off
echo ========================================
echo   WorldChat Enhanced Installation
echo ========================================
echo.

echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

echo [2/4] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

echo [3/4] Creating upload directories...
if not exist "public\uploads\images" mkdir "public\uploads\images"
if not exist "public\uploads\videos" mkdir "public\uploads\videos"  
if not exist "public\uploads\voice" mkdir "public\uploads\voice"

echo [4/4] Starting Enhanced WorldChat server...
echo.
echo ========================================
echo   WorldChat Enhanced is starting...
echo   🌍 Open your browser to: http://localhost:3000
echo   📸 Image sharing: Upload and share photos
echo   🎥 Video sharing: Share videos with built-in player  
echo   🎤 Voice messages: Record and send voice notes
echo ========================================
echo.
npm start
pause
