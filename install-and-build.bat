@echo off
cd /d "%~dp0"
echo === node ===
where node
node -v
echo === npm install ===
call npm install
echo === npm build ===
call npm run build
echo === EXIT %ERRORLEVEL% ===
