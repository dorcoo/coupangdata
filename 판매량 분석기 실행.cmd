@echo off
cd /d "%~dp0"
start "" /min npm.cmd run dev -- --host 127.0.0.1 --port 5173
ping 127.0.0.1 -n 3 >nul
start "" "http://127.0.0.1:5173"
