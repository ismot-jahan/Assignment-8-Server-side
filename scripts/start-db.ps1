<#
.SYNOPSIS
  Starts the local MongoDB that shomaj-server and shomaj-client expect.

.DESCRIPTION
  Downloads the official mongod build once (into ..\..\.mongod), then starts it
  against a project-local data folder on 127.0.0.1:27017. Nothing is installed
  system-wide and no Windows service is created.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/start-db.ps1
#>
$ErrorActionPreference = "Stop"

$root   = Split-Path -Parent $PSScriptRoot            # shomaj-server
$shimaj = Split-Path -Parent (Split-Path -Parent $root) # ...\Shimla
$mongoHome = Join-Path $shimaj ".mongod"
$zipPath   = Join-Path $mongoHome "mongodb.zip"
$dbPath    = Join-Path $mongoHome "data"
$port      = 27017
$version   = "8.0.4"
$url       = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-$version.zip"

function Test-Port {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $port)
    $c.Close()
    return $true
  } catch { return $false }
}

if (Test-Port) {
  Write-Host "MongoDB is already listening on 127.0.0.1:$port."
  exit 0
}

New-Item -ItemType Directory -Force -Path $mongoHome | Out-Null

# 1. Locate mongod.exe, downloading the archive on first run.
$mongod = Get-ChildItem -Path $mongoHome -Filter "mongod.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $mongod) {
  $expected = 775797076
  $haveZip = (Test-Path $zipPath) -and ((Get-Item $zipPath).Length -ge ($expected * 0.99))
  if (-not $haveZip) {
    Write-Host "Downloading MongoDB $version (about 740 MB)..."
    curl.exe -sS -L --retry 5 --retry-delay 2 -C - -o $zipPath $url
    if ($LASTEXITCODE -ne 0) { throw "Download failed (curl exit $LASTEXITCODE)." }
  }

  Write-Host "Extracting..."
  Expand-Archive -Path $zipPath -DestinationPath $mongoHome -Force
  $mongod = Get-ChildItem -Path $mongoHome -Filter "mongod.exe" -Recurse | Select-Object -First 1
  if (-not $mongod) { throw "mongod.exe not found after extraction." }
}

# 2. Fresh data folder -> create the indexes the app relies on at startup.
New-Item -ItemType Directory -Force -Path $dbPath | Out-Null

Write-Host "Starting mongod on 127.0.0.1:$port (data: $dbPath)"
Start-Process -FilePath $mongod.FullName `
  -ArgumentList @("--dbpath", $dbPath, "--bind_ip", "127.0.0.1", "--port", $port) `
  -WindowStyle Hidden

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Port) {
    Write-Host "MongoDB is up on 127.0.0.1:$port"
    exit 0
  }
}

throw "mongod did not come up on port $port within 30 seconds."
