param(
    [string]$SdkPath = ""
)

# Detecta el SDK de Android instalado por Android Studio y genera
# android/local.properties con la ruta correcta, sin depender de
# variables de entorno que se pierden entre sesiones de PowerShell.
#
# Uso normal (autodetecta):      .\fix-android-sdk.ps1
# Uso con ruta manual:           .\fix-android-sdk.ps1 -SdkPath "C:\ruta\al\Sdk"

if (-not (Test-Path "android")) {
    Write-Host "No encuentro la carpeta 'android'. Corre este script desde la raiz del proyecto" -ForegroundColor Red
    Write-Host "(el mismo nivel donde esta package.json), despues de 'npx expo prebuild -p android'."
    exit 1
}

if (-not $SdkPath) {
    $raw = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:ANDROID_HOME",
        "$env:ANDROID_SDK_ROOT",
        "C:\Android\Sdk"
    )

    Write-Host "Buscando el SDK en las ubicaciones habituales..."
    foreach ($p in $raw) {
        $valid = $p -match '^[A-Za-z]:\\' -and (Test-Path $p)
        Write-Host ("  {0,-6} {1}" -f $(if ($valid) { "[OK]" } else { "[no]" }), $p)
    }

    # Una ruta valida de SDK tiene forma de unidad + carpeta (ej. C:\algo),
    # no solo una letra suelta como "C" (variable de entorno mal definida).
    $candidates = $raw | Where-Object { $_ -match '^[A-Za-z]:\\' -and (Test-Path $_) }

    if (-not $candidates) {
        Write-Host "No encontre el SDK en las ubicaciones habituales." -ForegroundColor Red
        Write-Host "Abri Android Studio -> Settings -> Languages & Frameworks -> Android SDK"
        Write-Host "y copia el valor de 'Android SDK Location'. Despues corre:"
        Write-Host '  .\fix-android-sdk.ps1 -SdkPath "LA_RUTA_QUE_COPIASTE"'
        exit 1
    }

    $SdkPath = $candidates[0]
}

if (-not (Test-Path $SdkPath)) {
    Write-Host "La ruta '$SdkPath' no existe." -ForegroundColor Red
    exit 1
}

# Gradle necesita las barras invertidas escapadas dentro del archivo .properties
$escaped = $SdkPath -replace '\\', '\\\\'
"sdk.dir=$escaped" | Out-File -FilePath "android\local.properties" -Encoding ascii -NoNewline

Write-Host "SDK detectado en: $SdkPath" -ForegroundColor Green
Write-Host "Escribi android\local.properties correctamente." -ForegroundColor Green
Write-Host ""
Write-Host "Nota: 'npx expo prebuild --clean' borra la carpeta android/ entera, local.properties incluido."
Write-Host "Volve a correr este script despues de cada --clean. Si usas 'npx expo prebuild' sin --clean, se conserva."
