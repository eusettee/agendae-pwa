param([switch]$RedeLocal)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'mobile')
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel instalar as dependencias.' }
}
if ($RedeLocal) {
    & npm.cmd start -- --lan --port 0
} else {
    & npm.cmd start -- --tunnel --port 0
}
