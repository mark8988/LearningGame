param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$repositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$modelPath = Join-Path $repositoryPath '.tools/tessdata'
New-Item -ItemType Directory -Force -Path $modelPath | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$revision = '87416418657359cb625c412a48b6e1d6d41c29bd'
$hashes = @{ chi_tra = '1AA60488574CAFA69486D919284F079CA9B68FCC7F6AD8DC1FF1B318DFD97028'; eng = '7D4322BD2A7749724879683FC3912CB542F19906C83BCC1A52132556427170B2' }
foreach ($language in @('chi_tra', 'eng')) {
    $targetPath = Join-Path $modelPath "$language.traineddata"
    if (-not (Test-Path -LiteralPath $targetPath)) {
        $sourceUrl = if ($language -eq 'chi_tra') { 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/chi_tra.traineddata' } else { "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/$revision/$language.traineddata" }
        Invoke-WebRequest -UseBasicParsing -Uri $sourceUrl -OutFile $targetPath
    }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash
    if ($actual -ne $hashes[$language]) { throw "$language OCR language data checksum mismatch. Remove this downloaded language file and rerun setup." }
    Write-Host "$language OCR language data verified."
}
if (-not $SkipBuild) {
    Push-Location $repositoryPath
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
        npm run build:factory
        if ($LASTEXITCODE -ne 0) { throw 'Factory UI build failed' }
        dotnet build factory/ContentFactory/ContentFactory.csproj
        if ($LASTEXITCODE -ne 0) { throw 'Factory backend build failed' }
    } finally { Pop-Location }
}
