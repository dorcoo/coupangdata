@echo off
set "AI_ROOT=C:\AI\local-video-ai"
if not exist "%AI_ROOT%\.venv\Scripts\python.exe" goto missing
echo Starting Local Video AI...
echo Open http://127.0.0.1:8188 in your browser.
start "" http://127.0.0.1:8188
cd /d "%AI_ROOT%\ComfyUI"
"%AI_ROOT%\.venv\Scripts\python.exe" main.py --lowvram --preview-method auto
if errorlevel 1 pause
exit /b
:missing
echo Local Video AI installation was not found at %AI_ROOT%.
pause
exit /b 1
