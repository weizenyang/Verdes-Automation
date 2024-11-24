# Get the script's directory (resolve the base path for relative paths)
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

# Define relative paths
$exePath = Join-Path $scriptDir "tower-floorplate.exe"
$logFile = Join-Path $scriptDir "output.log"

# Ensure the log directory exists
$logDir = Split-Path -Path $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Run the executable and capture stdout and stderr
try {
    Start-Process -FilePath $exePath `
                  -NoNewWindow `
                  -RedirectStandardOutput $logFile `
                #   -RedirectStandardError $logFile `
                  -Wait
    Write-Host "Execution completed. Check logs at $logFile"
} catch {
    Add-Content -Path $logFile -Value "$(Get-Date): Error occurred: $_"
    Write-Error "An error occurred while running the executable."
}