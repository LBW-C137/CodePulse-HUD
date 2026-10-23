param([switch]$Build, [switch]$DeviceServer)
$ErrorActionPreference = 'Stop'
$hudRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $hudRoot
$desktopRoot = Join-Path $workspaceRoot 'CodePulse-Desktop'
$desktopApp = Join-Path $desktopRoot 'apps\desktop'
$hudApp = Join-Path $hudRoot 'apps\desktop'
$electron = Join-Path $desktopRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $electron)) {
    throw 'The CodePulse-Desktop development checkout or dependencies are missing. Read docs\WORKSPACE.md.'
}
if ($Build) {
    & pnpm --dir $hudRoot build
    if ($LASTEXITCODE -ne 0) { throw 'HUD build failed.' }
    & pnpm --dir $desktopRoot build
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    & pnpm --dir $desktopRoot --filter '@codepulse/desktop' rebuild:electron
    if ($LASTEXITCODE -ne 0) { throw 'Electron native dependency setup failed.' }
}
foreach ($entry in @((Join-Path $desktopApp 'out\main\index.js'), (Join-Path $hudApp 'out\renderer\index.html'))) {
    if (-not (Test-Path -LiteralPath $entry)) { throw 'Build outputs are missing. Run this script with -Build.' }
}
$listener = @(Get-NetTCPConnection -State Listen -LocalPort 17888 -ErrorAction SilentlyContinue)
if ($listener.Count) {
    throw 'A CodePulse instance already owns port 17888. Exit it from the tray before starting this build.'
}
$logsRoot = Join-Path $hudRoot '.tmpshots'
New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
$variableNames = @('CODEPULSE_HUD_ROOT', 'CODEPULSE_DISABLE_UPDATE_CHECKS', 'CODEPULSE_DEVICE_SERVER_ENABLED', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL')
$previous = @{}
foreach ($name in $variableNames) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:CODEPULSE_HUD_ROOT = $hudApp
    $env:CODEPULSE_DISABLE_UPDATE_CHECKS = '1'
    if ($DeviceServer) { $env:CODEPULSE_DEVICE_SERVER_ENABLED = '1' }
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Remove-Item Env:ELECTRON_RENDERER_URL -ErrorAction SilentlyContinue
    $desktopProcess = Start-Process -FilePath $electron -ArgumentList ('"' + $desktopApp + '"') -WorkingDirectory $desktopRoot -WindowStyle Normal -PassThru -RedirectStandardOutput (Join-Path $logsRoot 'unified-desktop.stdout.log') -RedirectStandardError (Join-Path $logsRoot 'unified-desktop.stderr.log')
    $desktopProcess.Id | Set-Content -LiteralPath (Join-Path $logsRoot 'unified-desktop.pid')
    Write-Host "CodePulse desktop + HUD launched in one process (PID $($desktopProcess.Id))."
    Write-Host 'Use the CodePulse tray menu to open either surface or quit the whole application.'
} finally {
    foreach ($name in $variableNames) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
