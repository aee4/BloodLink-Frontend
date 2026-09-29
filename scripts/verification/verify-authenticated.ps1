[CmdletBinding()]
param(
    [string]$ChromePath
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir 'verify-authenticated.mjs'
if (-not (Test-Path -LiteralPath $nodeScript -PathType Leaf)) {
    throw 'Authenticated verifier script was not found.'
}

if ([string]::IsNullOrWhiteSpace($ChromePath)) {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    $ChromePath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($ChromePath) -or -not (Test-Path -LiteralPath $ChromePath -PathType Leaf)) {
    throw 'Chrome or Edge was not found. Pass -ChromePath with the browser executable path.'
}

$email = Read-Host 'SystemAdmin email'
$securePassword = Read-Host 'SystemAdmin password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = $null

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrEmpty($plainPassword)) {
        throw 'Email and password are required.'
    }

    $payload = @{ email = $email; password = $plainPassword; chromePath = $ChromePath } | ConvertTo-Json -Compress
    $payload | node $nodeScript
    if ($LASTEXITCODE -ne 0) {
        throw "Authenticated verification failed with exit code $LASTEXITCODE."
    }
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $plainPassword = $null
    $securePassword = $null
    $payload = $null
}
