$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "Limpiando el log anterior..."
& $adb logcat -c

Write-Host ""
Write-Host "Ahora abri la app 'Time Manager' en el telefono." -ForegroundColor Yellow
Write-Host "Cuando termine de crashear, volve aca y apreta Enter." -ForegroundColor Yellow
Read-Host

Write-Host "Volcando el log de errores a crash-log.txt ..."
& $adb logcat -d *:E > crash-log.txt

Write-Host "Listo. Abri crash-log.txt y buscá 'FATAL EXCEPTION'." -ForegroundColor Green
