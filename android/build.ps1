# Build del APK de Tejado Solar VR para Pico 4
#
#   .\build.ps1              # compila la web + el APK firmado
#   .\build.ps1 -SkipWeb     # usa el dist/ que ya exista
#   .\build.ps1 -Install     # compila e instala en el Pico 4 conectado por USB
#
# Requiere: Node (npm), JDK 17/21, Android SDK (platform 34 + build-tools 34).
# Prepara los assets automaticamente: dist/ -> assets/site (tarea Gradle).

param(
    [string]$Jdk = "C:\Users\irjrubio\.jdk21\jdk-21.0.13+9",
    [string]$Sdk = "C:\Users\irjrubio\.android-sdk",
    [string]$Gradle = "C:\Users\irjrubio\.gradle-dist\gradle-8.9\bin\gradle.bat",
    [switch]$Install,
    [switch]$SkipWeb
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$repo = Split-Path -Parent $root

if (-not (Test-Path (Join-Path $Jdk 'bin\java.exe'))) {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        $Jdk = $env:JAVA_HOME
    } else {
        throw "No encuentro el JDK. Pasa -Jdk <ruta> o define JAVA_HOME (JDK 17/21)."
    }
}
if (-not (Test-Path $Sdk)) {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        $Sdk = $env:ANDROID_HOME
    } elseif ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
        $Sdk = $env:ANDROID_SDK_ROOT
    } else {
        throw "No encuentro el Android SDK. Pasa -Sdk <ruta> o define ANDROID_HOME."
    }
}

$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk

if (-not $SkipWeb) {
    Push-Location $repo
    & npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Fallo el build web" }
    Pop-Location
}

if (-not (Test-Path (Join-Path $repo 'dist\index.html'))) {
    throw "No existe dist/index.html. Ejecuta 'npm run build' en la raiz del repo."
}

if (-not (Test-Path (Join-Path $root 'local.properties'))) {
    $sdkesc = $Sdk -replace '\\', '\\\\' -replace ':', '\:'
    "sdk.dir=$sdkesc" | Set-Content (Join-Path $root 'local.properties') -Encoding ASCII
}

$gradleCmd = $Gradle
if (-not (Test-Path $gradleCmd)) {
    $gradleCmd = Join-Path $root 'gradlew.bat'
}

& $gradleCmd --console=plain assembleRelease
if ($LASTEXITCODE -ne 0) { throw "Fallo el build Android" }

$apk = Join-Path $root 'app\build\outputs\apk\release\app-release.apk'
$outDir = Join-Path $repo 'release'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir 'TejadoSolarVR-pico4.apk'
Copy-Item $apk $out -Force

$size = [Math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Host "`nAPK: $out ($size MB)" -ForegroundColor Green

if ($Install) {
    $adb = Join-Path $Sdk 'platform-tools\adb.exe'
    & $adb devices
    & $adb install -r $out
}
