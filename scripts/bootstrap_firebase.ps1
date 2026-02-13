param(
  [string]$ProjectId = "",
  [string]$AppId = ""
)

$ErrorActionPreference = "Stop"

function Ensure-Command($name, $installHint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name not found. $installHint"
  }
}

Ensure-Command "firebase" "Install with: npm install -g firebase-tools"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Firebase([string[]]$Args) {
  $output = & firebase @Args 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    throw ($output -join "`n")
  }
  return $output
}

function Try-Invoke-Firebase([string[]]$Args) {
  $output = & firebase @Args 2>&1
  return @{
    Output = $output
    Code = $LASTEXITCODE
  }
}

function Strip-Ansi([string]$text) {
  return ($text -replace "`e\[[0-9;]*m", "")
}

function Write-Firebaserc([string]$id) {
  $content = @()
  $content += "{"
  $content += '  "projects": {'
  $content += ('    "default": "{0}"' -f $id)
  $content += "  }"
  $content += "}"
  $content -join "`n" | Set-Content -Path ".firebaserc" -Encoding UTF8
}

try {
  Invoke-Firebase @("projects:list") | Out-Null
} catch {
  throw "Firebase login required. Run: firebase login"
}

$repoName = Split-Path -Leaf $repoRoot
$candidate = $repoName.ToLower()
$candidate = ($candidate -replace "[^a-z0-9]", "-")
$candidate = $candidate.Trim("-")
if ([string]::IsNullOrWhiteSpace($candidate)) {
  $candidate = "twin-growth-tracker"
}

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  $ProjectId = $candidate
}

function Project-Exists($id) {
  $listText = Strip-Ansi ((Invoke-Firebase @("projects:list")) | Out-String)
  return [regex]::IsMatch($listText, "^\s*$id\s", [System.Text.RegularExpressions.RegexOptions]::Multiline)
}

if (Project-Exists $ProjectId) {
  Write-Host "Project exists. Using: $ProjectId"
} else {
  Write-Host "Creating Firebase project: $ProjectId"
  Invoke-Firebase @("projects:create", $ProjectId) | Out-Null
}

Write-Firebaserc $ProjectId

Write-Host "Finding/creating web app..."
$AppName = "twin-growth-tracker"

function Find-AppId([string]$text, [string]$name) {
  $lines = $text -split "`r?`n"
  foreach ($line in $lines) {
    if ($line -match [regex]::Escape($name)) {
      if ($line -match "App ID:\s*([0-9]+:[0-9]+:web:[A-Za-z0-9]+)") {
        return $Matches[1]
      }
      if ($line -match "(1:\d+:web:[A-Za-z0-9]+)") {
        return $Matches[1]
      }
    }
  }
  if ($text -match "App ID:\s*([0-9]+:[0-9]+:web:[A-Za-z0-9]+)") {
    return $Matches[1]
  }
  if ($text -match "(1:\d+:web:[A-Za-z0-9]+)") {
    return $Matches[1]
  }
  return ""
}

function Find-AppIdFromJson([string]$jsonText, [string]$name) {
  if ([string]::IsNullOrWhiteSpace($jsonText)) {
    return ""
  }
  try {
    $obj = $jsonText | ConvertFrom-Json
  } catch {
    return ""
  }
  $apps = @()
  if ($obj.apps) { $apps = $obj.apps }
  elseif ($obj.result) { $apps = $obj.result }
  elseif ($obj) { $apps = $obj }
  foreach ($app in $apps) {
    if ($app.platform -and $app.platform -ne "WEB") { continue }
    if ($app.displayName -and $app.displayName -ne $name) { continue }
    if ($app.appId) { return $app.appId }
    if ($app.appId -eq $null -and $app.app_id) { return $app.app_id }
  }
  foreach ($app in $apps) {
    if ($app.platform -and $app.platform -ne "WEB") { continue }
    if ($app.appId) { return $app.appId }
    if ($app.app_id) { return $app.app_id }
  }
  return ""
}

if ([string]::IsNullOrWhiteSpace($AppId)) {
  $appsResult = Try-Invoke-Firebase @("apps:list", "--project", $ProjectId, "--json")
  $appsText = Strip-Ansi ($appsResult.Output | Out-String)
  if ($appsResult.Code -eq 0) {
    $AppId = Find-AppIdFromJson $appsText $AppName
    if ([string]::IsNullOrWhiteSpace($AppId)) {
      $AppId = Find-AppId $appsText $AppName
    }
  }
}

if ([string]::IsNullOrWhiteSpace($AppId)) {
  $createResult = Try-Invoke-Firebase @("apps:create", "web", $AppName, "--project", $ProjectId, "--json")
  $appOutputText = Strip-Ansi ($createResult.Output | Out-String)
  if ($createResult.Code -eq 0) {
    $AppId = Find-AppIdFromJson $appOutputText $AppName
  }
  $AppId = Find-AppId $appOutputText $AppName
  if ([string]::IsNullOrWhiteSpace($AppId) -and $createResult.Code -ne 0) {
    throw ($createResult.Output -join "`n")
  }
}

if ([string]::IsNullOrWhiteSpace($AppId)) {
  $logPath = Join-Path $repoRoot "firebase-app-output.log"
  @(
    "== apps:list output =="
    $appsText
    ""
    "== apps:create output =="
    $appOutputText
  ) | Set-Content -Path $logPath -Encoding UTF8
  throw "Failed to detect App ID from firebase output. See firebase-app-output.log or pass -AppId."
}

New-Item -ItemType Directory -Force -Path docs | Out-Null

Write-Host "Fetching sdk config..."
$tmpFile = Join-Path $repoRoot "docs\\sdkconfig.json"
Invoke-Firebase @("apps:sdkconfig", "WEB", $AppId, "-o", $tmpFile) | Out-Null
$configJson = Get-Content -Path $tmpFile -Raw
if ([string]::IsNullOrWhiteSpace($configJson)) {
  throw "Failed to read sdkconfig JSON output."
}
$config = $configJson | ConvertFrom-Json

$js = @()
$js += "// Auto-generated by scripts/bootstrap_firebase.ps1"
$js += "export const firebaseConfig = " + (ConvertTo-Json $config -Depth 10) + ";"
$js += ""
$js -join "`n" | Set-Content -Path "docs/firebase-config.js" -Encoding UTF8

Write-Host "Initialize Firestore (interactive). Choose Firestore only when prompted."
Invoke-Firebase @("init", "firestore") | Out-Null

Write-Host "Next manual steps:"
Write-Host "1) Create Firestore database and select location (if not created)."
Write-Host "2) Enable Anonymous Auth in Firebase console."
