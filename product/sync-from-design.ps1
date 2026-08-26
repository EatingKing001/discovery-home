<#
.SYNOPSIS
  从设计仓同步视觉文件，并自动向 HTML 注入 product/ 业务脚本。

.PARAMETER Source
  设计仓根目录。默认：C:\Users\tanqiwen\Desktop\project\inkstone-website

.EXAMPLE
  .\product\sync-from-design.ps1
  .\product\sync-from-design.ps1 -Source "D:\path\to\inkstone-website"
#>
[CmdletBinding()]
param(
  [string]$Source = "C:\Users\tanqiwen\Desktop\project\inkstone-website"
)

$ErrorActionPreference = "Stop"
$Dest = Split-Path -Parent $PSScriptRoot
$BizVer = "20260826-biz1"

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Read-Utf8 {
  param([string]$Path)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Get-Newline([string]$Html) {
  if ($Html -match "`r`n") { return "`r`n" }
  return "`n"
}

function Remove-OldBizScripts([string]$Html) {
  $patterns = @(
    '(?im)^\s*<script\b[^>]*\bsrc\s*=\s*["''][^"'']*shared/js/site-links\.js[^"'']*["''][^>]*>\s*</script>\s*\r?\n?',
    '(?im)^\s*<script\b[^>]*\bsrc\s*=\s*["''][^"'']*shared/js/business/[^"'']+\.js[^"'']*["''][^>]*>\s*</script>\s*\r?\n?',
    '(?im)^\s*<!--\s*正式仓业务薄层[^>]*-->\s*\r?\n?'
  )
  foreach ($p in $patterns) {
    $Html = [regex]::Replace($Html, $p, "")
  }
  return $Html
}

function Insert-BeforeMatch {
  param([string]$Html, [string]$Tag, [string]$AnchorRegex)
  $m = [regex]::Match($Html, $AnchorRegex, "IgnoreCase, Multiline")
  if (-not $m.Success) { return $null }
  $nl = Get-Newline $Html
  return $Html.Substring(0, $m.Index) + $Tag + $nl + $Html.Substring($m.Index)
}

function Insert-AfterMatch {
  param([string]$Html, [string]$Tag, [string]$AnchorRegex, [switch]$Last)
  $opts = [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Multiline
  $matches = [regex]::Matches($Html, $AnchorRegex, $opts)
  if ($matches.Count -eq 0) { return $null }
  $m = if ($Last) { $matches[$matches.Count - 1] } else { $matches[0] }
  $nl = Get-Newline $Html
  $pos = $m.Index + $m.Length
  if ($pos -lt $Html.Length -and $Html[$pos] -eq "`r") { $pos++ }
  if ($pos -lt $Html.Length -and $Html[$pos] -eq "`n") { $pos++ }
  return $Html.Substring(0, $pos) + $Tag + $nl + $Html.Substring($pos)
}

function Has-Src([string]$Html, [string]$Needle) {
  return $Html -match [regex]::Escape($Needle)
}

function Patch-IndexHtml([string]$Path) {
  $html = Remove-OldBizScripts (Read-Utf8 $Path)
  $injected = @()
  $shellRe = '(?m)^\s*<script\b[^>]*\bsrc\s*=\s*["''][^"'']*shared/js/shell\.js[^"'']*["''][^>]*>\s*</script>\s*$'

  if (-not (Has-Src $html "product/site-links.js")) {
    $next = Insert-BeforeMatch $html "<script src=`"product/site-links.js?v=$BizVer`" defer></script>" $shellRe
    if ($null -eq $next) { Write-Warning "index.html：未找到 shell.js，无法注入 site-links.js" }
    else { $html = $next; $injected += "index.html → product/site-links.js" }
  }

  if (-not (Has-Src $html "product/cooperation-submit.js")) {
    $next = Insert-AfterMatch $html "<script src=`"product/cooperation-submit.js?v=$BizVer`" defer></script>" $shellRe
    if ($null -eq $next) { Write-Warning "index.html：未找到 shell.js，无法注入 cooperation-submit.js" }
    else { $html = $next; $injected += "index.html → product/cooperation-submit.js" }
  }

  Write-Utf8NoBom $Path $html
  return $injected
}

function Patch-HomeHtml([string]$Path) {
  $html = Remove-OldBizScripts (Read-Utf8 $Path)
  $injected = @()
  $earlyRe = '(?m)^\s*<script\b[^>]*\bsrc\s*=\s*["''](?:data/[^"'']+|home\.js)[^"'']*["''][^>]*>\s*</script>\s*$'
  $homeRe = '(?m)^\s*<script\b[^>]*\bsrc\s*=\s*["''][^"'']*home\.js[^"'']*["''][^>]*>\s*</script>\s*$'
  $productBizRe = '(?m)^\s*<script\b[^>]*\bsrc\s*=\s*["''][^"'']*product/(?:protocol-links|downloads|cooperation-submit)\.js[^"'']*["''][^>]*>\s*</script>\s*$'

  if (-not (Has-Src $html "product/site-links.js")) {
    $next = Insert-BeforeMatch $html "<script src=`"../../product/site-links.js?v=$BizVer`" defer></script>" $earlyRe
    if ($null -eq $next) { Write-Warning "tabs/home/index.html：未找到 home.js/data 脚本，无法注入 site-links.js" }
    else { $html = $next; $injected += "tabs/home/index.html → product/site-links.js" }
  }

  $biz = @(
    @{ Needle = "product/protocol-links.js"; Tag = "<script src=`"../../product/protocol-links.js?v=$BizVer`" defer></script>" },
    @{ Needle = "product/downloads.js"; Tag = "<script src=`"../../product/downloads.js?v=$BizVer`" defer></script>" },
    @{ Needle = "product/cooperation-submit.js"; Tag = "<script src=`"../../product/cooperation-submit.js?v=$BizVer`" defer></script>" }
  )

  foreach ($s in $biz) {
    if (Has-Src $html $s.Needle) { continue }
    $next = $null
    if ($html -match "product/(?:protocol-links|downloads|cooperation-submit)\.js") {
      $next = Insert-AfterMatch $html $s.Tag $productBizRe -Last
    }
    if ($null -eq $next) {
      $next = Insert-AfterMatch $html $s.Tag $homeRe
    }
    if ($null -eq $next) {
      Write-Warning "tabs/home/index.html：未找到 home.js，无法注入 $($s.Needle)"
    } else {
      $html = $next
      $injected += "tabs/home/index.html → $($s.Needle)"
    }
  }

  Write-Utf8NoBom $Path $html
  return $injected
}

# --- main ---
if (-not (Test-Path -LiteralPath $Source)) {
  throw "设计仓不存在：$Source"
}

Write-Host "Source: $Source"
Write-Host "Dest:   $Dest"
Write-Host ""

foreach ($rel in @("tabs\home", "shared", "design-system")) {
  $from = Join-Path $Source $rel
  $to = Join-Path $Dest $rel
  if (-not (Test-Path -LiteralPath $from)) {
    Write-Warning "跳过（源不存在）：$rel"
    continue
  }
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  & robocopy $from $to /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -ge 8) { throw "robocopy 失败 ($rc)：$rel" }
  Write-Host "robocopy OK ($rc): $rel"
}

$srcIndex = Join-Path $Source "index.html"
$dstIndex = Join-Path $Dest "index.html"
if (Test-Path -LiteralPath $srcIndex) {
  Copy-Item -LiteralPath $srcIndex -Destination $dstIndex -Force
  Write-Host "Copy-Item OK: index.html"
} else {
  Write-Warning "源缺少 index.html，跳过覆盖"
}

$allInjected = @()
$allInjected += Patch-IndexHtml $dstIndex
$homeHtml = Join-Path $Dest "tabs\home\index.html"
if (Test-Path -LiteralPath $homeHtml) {
  $allInjected += Patch-HomeHtml $homeHtml
} else {
  Write-Warning "缺少 tabs/home/index.html，跳过注入"
}

Write-Host ""
Write-Host "已同步设计文件（tabs/home、shared、design-system、index.html）。"
Write-Host "未覆盖：product/、docs/、README.md"
if ($allInjected.Count -gt 0) {
  Write-Host "已注入 product script："
  $allInjected | ForEach-Object { Write-Host "  - $_" }
} else {
  Write-Host "已注入：无新增（HTML 中已有正确 product script，幂等跳过）。"
}
Write-Host ""
Write-Host "预览："
Write-Host "  npx http-server -p 8023 -c-1"
Write-Host "请勿用默认开启 cleanUrls 的 serve（会改写路径）。"
