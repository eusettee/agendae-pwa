# Inicia o n8n local com o fluxo "Agendaê · Atendimento WhatsApp" importado e ativo.
# Uso: em um terminal, npm start; em outro, .\iniciar-n8n.ps1
$ErrorActionPreference = 'Stop'
$projeto = $PSScriptRoot
$envLocal = Join-Path $projeto '.env.local'
$token = $null
if (Test-Path $envLocal) {
  $linha = Get-Content $envLocal | Where-Object { $_ -match '^GATEWAY_TOKEN=' } | Select-Object -First 1
  if ($linha) { $token = $linha.Substring(14) }
}
if (-not $token) { throw 'Defina GATEWAY_TOKEN no .env.local (o mesmo valor é usado pela API e pelo n8n).' }

$env:N8N_USER_FOLDER = Join-Path $projeto '.n8n'
$env:N8N_PORT = '5678'
$env:N8N_SECURE_COOKIE = 'false'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_PERSONALIZATION_ENABLED = 'false'
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = 'false'
$env:AGENDAE_API_URL = 'http://localhost:3000'
$env:AGENDAE_GATEWAY_TOKEN = $token

$n8n = Join-Path $env:USERPROFILE 'n8n-local\node_modules\.bin\n8n.cmd'
if (-not (Test-Path $n8n)) {
  Write-Host 'Instalando o n8n (somente na primeira vez)...'
  New-Item -ItemType Directory -Force (Join-Path $env:USERPROFILE 'n8n-local') | Out-Null
  Push-Location (Join-Path $env:USERPROFILE 'n8n-local'); npm init -y | Out-Null; npm install n8n@2.46.7 --no-audit --no-fund; Pop-Location
}
$fluxo = Join-Path $projeto 'integrations\n8n\agendae-whatsapp.json'
& $n8n import:workflow --input="$fluxo"
& $n8n publish:workflow --id=agendaeWhatsapp01
Write-Host 'n8n: http://localhost:5678  ·  webhook do app: http://localhost:5678/webhook/agendae-chat'
& $n8n start
