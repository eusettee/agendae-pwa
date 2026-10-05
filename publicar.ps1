$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Assert-Success([string]$Message) { if ($LASTEXITCODE -ne 0) { throw $Message } }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Instale o GitHub CLI (gh) para publicar.' }
gh auth status
if ($LASTEXITCODE -ne 0) {
  gh auth login --hostname github.com --git-protocol https --web
  Assert-Success 'Autenticação no GitHub necessária.'
}
if (-not (Test-Path -LiteralPath '.git')) {
  git init -b main
  Assert-Success 'Não foi possível iniciar o Git.'
}
git add .
Assert-Success 'Não foi possível adicionar os arquivos.'
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git commit -m 'feat: PWA Agendae com agendamento e modo offline'
  Assert-Success 'Não foi possível criar o commit.'
}
$Remotes = @(git remote)
Assert-Success 'Não foi possível verificar os remotos Git.'
if ($Remotes -notcontains 'origin') {
  gh repo create agendae-pwa --private --source . --remote origin --push
  Assert-Success 'Não foi possível criar o repositório. Verifique se agendae-pwa já existe.'
} else {
  git push -u origin main
  Assert-Success 'Não foi possível enviar ao GitHub.'
}
npx.cmd --yes vercel@latest whoami
if ($LASTEXITCODE -ne 0) {
  npx.cmd --yes vercel@latest login
  Assert-Success 'Autenticação na Vercel necessária.'
}
npx.cmd --yes vercel@latest link --yes --project agendae-pwa
Assert-Success 'Não foi possível vincular o projeto na Vercel.'
npx.cmd --yes vercel@latest --prod --yes
Assert-Success 'Não foi possível publicar na Vercel.'
npx.cmd --yes vercel@latest git connect --yes
Assert-Success 'Site publicado, mas falta autorizar a integração GitHub na Vercel para os próximos deploys automáticos.'
Write-Host 'GitHub e Vercel publicados. A URL de produção aparece acima.'
