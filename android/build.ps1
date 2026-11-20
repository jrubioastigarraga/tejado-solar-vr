# Build del APK de Tejado Solar VR para Pico 4
#
#   .\build.ps1              # compila la web + el APK firmado
#   .\build.ps1 -SkipWeb     # usa el dist/ que ya exista
#   .\build.ps1 -Install     # compila e instala en el Pico 4 conectado por USB
#
# Requiere: Node (npm), JDK 17/21, Android SDK (platform 34 + build-tools 34).
# Prepara los assets automaticamente: dist/ -> assets/site (tarea Gradle).

param(
    [string]$Jdk,
    [string]$Sdk,
    [switch]$Install,
    [switch]$SkipWeb
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$repo = Split-Path -Parent $root

function Find-Jdk {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        return $env:JAVA_HOME
    }
    foreach ($dir in (Get-ChildItem -Path $HOME -Directory -Filter '.jdk*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
        $jdk = Get-ChildItem -Path $dir.FullName -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1
        if ($jdk -and (Test-Path (Join-Path $jdk.FullName 'bin\java.exe'))) { return $jdk.FullName }
        if (Test-Path (Join-Path $dir.FullName 'bin\java.exe')) { return $dir.FullName }
    }
    return $null
}

function Find-AndroidSdk {
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        (Join-Path $HOME '.android-sdk'),
        (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path $path)) { return $path }
    }
    return $null
}

if (-not $Jdk) { $Jdk = Find-Jdk }
if (-not $Jdk -or -not (Test-Path (Join-Path $Jdk 'bin\java.exe'))) {
    throw "No encuentro el JDK. Pasa -Jdk <ruta> o define JAVA_HOME (JDK 17/21)."
}
if (-not $Sdk) { $Sdk = Find-AndroidSdk }
if (-not $Sdk -or -not (Test-Path $Sdk)) {
    throw "No encuentro el Android SDK. Pasa -Sdk <ruta> o define ANDROID_HOME."
}

$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk

if (-not $SkipWeb) {
    Push-Location $repo
    # esbuild escribe su resumen en stderr: bajamos el ErrorActionPreference
    # mientras corre para que PowerShell no lo trate como error terminante.
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & npm run build
    $buildCode = $LASTEXITCODE
    $ErrorActionPreference = $previousEap
    if ($buildCode -ne 0) { Pop-Location; throw "Fallo el build web" }
    Pop-Location
}

if (-not (Test-Path (Join-Path $repo 'dist\index.html'))) {
    throw "No existe dist/index.html. Ejecuta 'npm run build' en la raiz del repo."
}

$propsFile = Join-Path $root 'local.properties'
$props = @()
if (Test-Path $propsFile) { $props = @(Get-Content $propsFile) }
if (-not ($props -match '^\s*sdk\.dir\s*=')) {
    $sdkesc = ($Sdk -replace '\\', '\\') -replace ':', '\:'
    $props += "sdk.dir=$sdkesc"
    Set-Content -Path $propsFile -Value $props -Encoding ASCII
}

& (Join-Path $root 'gradlew.bat') --console=plain assembleRelease
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
