$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$queryPath = Join-Path $PSScriptRoot 'demo-search-queries.json'
$sourceDirectory = Join-Path $projectRoot '.cache\demo-source'
$creditsPath = Join-Path $projectRoot 'public\demo\demo-asset-credits.json'
$apiEndpoint = 'https://api.openverse.org/v1/images/'
$downloadDate = Get-Date -Format 'yyyy-MM-dd'
$userAgent = 'MEMENTO/1.0 (local portfolio demo asset curation)'

function Invoke-WithRetry {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Operation,
    [int]$Attempts = 3
  )
  $latest = $null
  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    try {
      return & $Operation
    }
    catch {
      $latest = $_
      if ($attempt -lt $Attempts) {
        $statusCode = $null
        if ($null -ne $_.Exception.Response) {
          try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { $statusCode = $null }
        }
        Start-Sleep -Seconds $(if ($statusCode -eq 429) { 30 * $attempt } else { 3 * $attempt })
      }
    }
  }
  throw $latest
}

function Get-SearchVariants {
  param([Parameter(Mandatory = $true)][string]$Query)
  $tokens = @($Query -split '\s+' | Where-Object { $_.Length -ge 3 })
  $variants = [System.Collections.Generic.List[string]]::new()
  $variants.Add($Query)
  if ($tokens.Count -gt 2) { $variants.Add("$($tokens[0]) $($tokens[-1])") }
  if ($tokens.Count -gt 0) { $variants.Add($tokens[0]) }
  return @($variants | Select-Object -Unique)
}

function Test-DownloadedJpeg {
  param([Parameter(Mandatory = $true)][string]$Path)
  try {
    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile($Path)
    try {
      return [pscustomobject]@{ width = $image.Width; height = $image.Height }
    }
    finally {
      $image.Dispose()
    }
  }
  catch {
    return $null
  }
}

$queries = Get-Content -Raw -Encoding utf8 $queryPath | ConvertFrom-Json
if ($queries.Count -ne 60) { throw 'Expected exactly 60 controlled demo search queries.' }
New-Item -ItemType Directory -Path $sourceDirectory -Force | Out-Null

$records = @()
if (Test-Path -LiteralPath $creditsPath) {
  $existing = Get-Content -Raw -Encoding utf8 $creditsPath | ConvertFrom-Json
  if ($null -ne $existing.assets -and $existing.source -eq 'Openverse') {
    $records = @($existing.assets)
  }
}
$usedIds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($record in $records) { [void]$usedIds.Add([string]$record.openverseId) }

for ($index = $records.Count; $index -lt $queries.Count; $index += 1) {
  $query = [string]$queries[$index]
  $candidatePool = [System.Collections.Generic.List[object]]::new()
  $candidateQueries = @{}
  foreach ($searchQuery in (Get-SearchVariants $query)) {
    Start-Sleep -Milliseconds 1400
    $parameters = [ordered]@{
      q = $searchQuery
      license = 'cc0'
      extension = 'jpg'
      mature = 'false'
      page_size = '20'
    }
    $queryParts = foreach ($entry in $parameters.GetEnumerator()) {
      '{0}={1}' -f [uri]::EscapeDataString($entry.Key), [uri]::EscapeDataString([string]$entry.Value)
    }
    $uri = "$apiEndpoint`?$($queryParts -join '&')"
    $data = Invoke-WithRetry {
      Invoke-RestMethod -Uri $uri -Headers @{ 'User-Agent' = $userAgent } -TimeoutSec 60
    }
    $candidates = @($data.results) | Where-Object {
      $_.license -eq 'cc0' -and
      $_.provider -ne 'wikimedia' -and
      -not $usedIds.Contains([string]$_.id) -and
      $_.width -ge 800 -and
      $_.height -ge 600 -and
      ($_.width / $_.height) -ge 0.55 -and
      ($_.width / $_.height) -le 2.0
    }
    foreach ($candidate in @($candidates | Select-Object -First 20)) {
      $candidateId = [string]$candidate.id
      if (-not $candidateQueries.ContainsKey($candidateId)) {
        $candidatePool.Add($candidate)
        $candidateQueries[$candidateId] = $searchQuery
      }
    }
  }
  if ($candidatePool.Count -eq 0) { throw "No unused CC0 JPEG found for query: $query" }

  $number = ($index + 1).ToString('000')
  $outputPath = Join-Path $sourceDirectory "memory-$number.jpg"
  $selected = $null
  $matchedQuery = ''
  $downloadedFrom = ''
  $dimensions = $null
  foreach ($candidate in $candidatePool) {
    $downloadCandidates = @([string]$candidate.url, [string]$candidate.thumbnail) |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
    foreach ($downloadUrl in $downloadCandidates) {
      try {
        Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -Headers @{ 'User-Agent' = $userAgent } -OutFile $outputPath -TimeoutSec 25 | Out-Null
        $dimensions = Test-DownloadedJpeg $outputPath
        if ($null -ne $dimensions -and $dimensions.width -ge 600 -and $dimensions.height -ge 450) {
          $downloadedFrom = $downloadUrl
          $selected = $candidate
          $matchedQuery = [string]$candidateQueries[[string]$candidate.id]
          break
        }
      }
      catch {
        $dimensions = $null
      }
      $dimensions = $null
      if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
    }
    if ($null -ne $selected) { break }
  }
  if ($null -eq $selected -or $null -eq $dimensions) { throw "Unable to download a valid JPEG for query: $query" }

  $record = [ordered]@{
    memoryId = "demo-memory-$number"
    localSource = ".cache/demo-source/memory-$number.jpg"
    query = $query
    matchedQuery = $matchedQuery
    title = [string]$selected.title
    pageUrl = [string]$selected.foreign_landing_url
    author = [string]$selected.creator
    credit = "Source indexed by Openverse; original provider: $([string]$selected.provider)"
    license = 'CC0'
    licenseUrl = 'https://creativecommons.org/publicdomain/zero/1.0/'
    openverseId = [string]$selected.id
    provider = [string]$selected.provider
    source = [string]$selected.source
    sourceUrl = [string]$selected.url
    downloadedUrl = $downloadedFrom
    downloadDate = $downloadDate
    originalWidth = [int]$selected.width
    originalHeight = [int]$selected.height
    downloadedWidth = [int]$dimensions.width
    downloadedHeight = [int]$dimensions.height
    byteLength = [int64](Get-Item -LiteralPath $outputPath).Length
  }
  $records += [pscustomobject]$record
  [void]$usedIds.Add([string]$selected.id)
  [ordered]@{
    schemaVersion = 1
    source = 'Openverse'
    api = 'https://api.openverse.org/v1/images/'
    assets = $records
  } | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $creditsPath -Encoding utf8
  Write-Output "$number/060 $([string]$selected.title)"
}

Write-Output "Recorded $($records.Count) CC0 assets at $creditsPath"
