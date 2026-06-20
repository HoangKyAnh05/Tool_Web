@echo off
title Cleaning renderer.js
echo Cleaning corrupted null bytes from renderer/renderer.js...
powershell -Command "$path = 'renderer/renderer.js'; if (Test-Path $path) { $bytes = [System.IO.File]::ReadAllBytes($path); $clean = $bytes | Where-Object { $_ -ne 0 }; [System.IO.File]::WriteAllBytes($path, $clean); echo '[SUCCESS] renderer.js cleaned successfully!' } else { echo '[ERROR] renderer.js not found!' }"
pause
