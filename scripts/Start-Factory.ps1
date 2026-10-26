param([int]$Port = 5088)
$ErrorActionPreference = 'Stop'
$repositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
if (-not (Test-Path -LiteralPath (Join-Path $repositoryPath 'factory/ContentFactory/wwwroot/index.html'))) { throw 'Run scripts/Setup-Factory.ps1 first.' }
Push-Location $repositoryPath
try {
    Write-Host "Local content factory: http://127.0.0.1:$Port/"
    dotnet run --project factory/ContentFactory/ContentFactory.csproj --no-build --no-launch-profile -- "--Factory:Url=http://127.0.0.1:$Port"
    if ($LASTEXITCODE -ne 0) { throw 'Content factory stopped with an error.' }
} finally { Pop-Location }
