@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -Command "$taskNode = Get-Command node.exe -ErrorAction SilentlyContinue; if ($taskNode) { $taskNodePath = $taskNode.Source } else { $taskRuntime = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' | Sort-Object Version -Descending | Select-Object -First 1; if ($taskRuntime) { $taskNodePath = Join-Path $taskRuntime.InstallLocation 'dependencies\node\bin\node.exe' } }; if (!$taskNodePath -or !(Test-Path -LiteralPath $taskNodePath)) { Write-Host '분석기 실행 환경을 찾지 못했습니다.'; exit 1 }; & $taskNodePath 'scripts/start.mjs'; exit $LASTEXITCODE"
if errorlevel 1 pause
