param([switch]$Preview)
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$previousEnabled = $env:CODEPULSE_DEVICE_SERVER_ENABLED
$env:CODEPULSE_DEVICE_SERVER_ENABLED = '1'
Push-Location -LiteralPath $repositoryRoot
try {
    Write-Host 'Starting CodePulse HUD with the LAN device API enabled.'
    Write-Host 'Exit any installed CodePulse/HUD instance first; open Settings > device provisioning after startup.'
    if ($Preview) {
        & pnpm --filter '@codepulse-hud/desktop' start
    } else {
        & pnpm dev
    }
    if ($LASTEXITCODE -ne 0) { throw 'CodePulse startup failed. Review the output above.' }
} finally {
    Pop-Location
    $env:CODEPULSE_DEVICE_SERVER_ENABLED = $previousEnabled
}
