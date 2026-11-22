param([switch]$Unregister)

$ErrorActionPreference = 'Stop'
$hostName = 'com.karmolab.sync_probe'
$registry = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
$nativeManifest = Join-Path $PSScriptRoot 'host.json'
if ($Unregister) {
    if ((Test-Path -LiteralPath $registry) -and (Get-Item -LiteralPath $registry).GetValue('') -eq $nativeManifest) {
        Remove-Item -LiteralPath $registry
    }
    return
}
if ((Test-Path -LiteralPath $registry) -and (Get-Item -LiteralPath $registry).GetValue('') -ne $nativeManifest) {
    throw 'The existing KarmoLab probe registration points to a different directory.'
}
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$binary = Join-Path $PSScriptRoot 'probe-host.exe'
& $compiler /nologo /platform:anycpu /target:exe /r:System.Web.Extensions.dll "/out:$binary" (Join-Path $PSScriptRoot 'Host.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native sync probe compilation failed.' }
$settings = @{
    name = $hostName
    description = 'KarmoLab isolated sync probe'
    path = $binary
    type = 'stdio'
    allowed_origins = @('chrome-extension://jeejnajjlpdepjaelmahdlialbhcfbed/')
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($nativeManifest, $settings, [System.Text.UTF8Encoding]::new($false))
New-Item -Path $registry -Force | Out-Null
Set-Item -LiteralPath $registry -Value $nativeManifest
Write-Output $binary
