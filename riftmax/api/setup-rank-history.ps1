# Creates a persistent D1 database for verified ranked snapshots.
# Run from the riftmax/api directory after wrangler login.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$cfgPath = Join-Path $PSScriptRoot "wrangler.toml"
$cfg = Get-Content $cfgPath -Raw

if ($cfg -notmatch '(?m)^\[\[d1_databases\]\]') {
  Write-Host "Creating Cloudflare D1 database..."
  $created = (& npx.cmd wrangler d1 create riftmax-rank-history 2>&1 | Out-String)
  Write-Host $created
  if ($LASTEXITCODE -ne 0) {
    throw "D1 creation failed. Retry after checking Cloudflare login."
  }

  $foundId = [regex]::Match($created, 'database_id\s*=\s*["'']([0-9a-fA-F-]{36})["'']')
  if (-not $foundId.Success) {
    throw "Could not read database_id. Find the generated ID in Cloudflare, then add the [[d1_databases]] binding manually."
  }

  $id = $foundId.Groups[1].Value
  Add-Content -Path $cfgPath -Value @"

[[d1_databases]]
binding = "RANK_DB"
database_name = "riftmax-rank-history"
database_id = "$id"
"@
}

Write-Host "Applying rank history schema..."
& npx.cmd wrangler d1 execute riftmax-rank-history --remote --file=./schema.sql
if ($LASTEXITCODE -ne 0) {throw "Schema migration failed."}

Write-Host "Deploying Riftmax Worker with D1 binding..."
& npx.cmd wrangler deploy
if ($LASTEXITCODE -ne 0) {throw "Worker deployment failed."}

Write-Host "Rank tracking is enabled. The tracked peak starts at the first successful profile lookup."
Write-Host "Earlier historical ranks still cannot be reconstructed from Riot's API."
