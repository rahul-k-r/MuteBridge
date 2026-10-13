# Builds the single-file host into .\dist\MuteBridgeHost.exe. Double-click that exe to install it.
# Native AOT locates the MSVC linker via vswhere, which isn't on PATH by default.
$env:PATH += ";${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer"
dotnet publish (Join-Path $PSScriptRoot 'host') -c Release -o (Join-Path $PSScriptRoot 'dist')
if ($LASTEXITCODE -ne 0) { throw 'publish failed' }
