$ErrorActionPreference = 'Stop'

$url = 'https://github.com/santokhan/download/raw/refs/heads/main/inply.zip'
$tempDir = Join-Path $env:TEMP 'inply-extension-install'
$zipFile = Join-Path $tempDir 'inply.zip'
$extractDir = Join-Path $tempDir 'extracted'
$targetDir = Join-Path $env:LOCALAPPDATA 'BrowserExtensions\inply'

try {
    Write-Host "`n1. Preparing temporary directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    if (Test-Path -LiteralPath $extractDir) {
        Remove-Item -LiteralPath $extractDir -Recurse -Force
    }

    Write-Host "`n2. Downloading extension..." -ForegroundColor Cyan
    $requestParams = @{
        Uri                = $url
        OutFile            = $zipFile
        UseBasicParsing    = $true
        ErrorAction        = 'Stop'
    }
    Invoke-WebRequest @requestParams

    if (!(Test-Path -LiteralPath $zipFile) -or (Get-Item -LiteralPath $zipFile).Length -eq 0) {
        throw 'Download failed or the ZIP file is empty.'
    }

    Write-Host "`n3. Extracting and validating extension..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
    Expand-Archive -LiteralPath $zipFile -DestinationPath $extractDir -Force

    # Archives may contain the extension files directly or inside one wrapper folder.
    $manifest = Get-ChildItem -LiteralPath $extractDir -Filter 'manifest.json' -File -Recurse |
        Select-Object -First 1
    if (!$manifest) {
        throw 'The downloaded archive does not contain manifest.json; it is not a browser extension package.'
    }
    $sourceDir = $manifest.Directory.FullName

    Write-Host "`n4. Installing extension files..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Get-ChildItem -LiteralPath $sourceDir -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $targetDir -Recurse -Force
    }

    if (!(Test-Path -LiteralPath (Join-Path $targetDir 'manifest.json'))) {
        throw "Installation verification failed: manifest.json was not copied to '$targetDir'."
    }

    Remove-Item -LiteralPath $tempDir -Recurse -Force
    Write-Host "`nInstallation completed successfully!`nTarget: $targetDir" -ForegroundColor Green
}
catch {
    Write-Host "`nInstallation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Temporary files retained at: $tempDir" -ForegroundColor Yellow
    Write-Host 'Check that the target folder is writable and that no files are locked by the browser.'
    exit 1
}
