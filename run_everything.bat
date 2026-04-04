@echo off
echo Killing all running Node servers to free up port 5000...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo Starting Backend Server...
cd server
start cmd /k "node server.js"

echo.
echo Starting Frontend Server...
cd ..
start cmd /k "npm run dev"

echo.
echo Complete! Two new windows should have popped up for the frontend and backend.
pause
