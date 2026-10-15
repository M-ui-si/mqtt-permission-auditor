$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $root 'agh_launcher.py'
$output = Join-Path $root 'MQTT权限迁移审计器.exe'
$work = Join-Path $root '.local\agh-launcher-build'
$dist = Join-Path $work 'dist'

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "启动器源码不存在：$source"
}

pyinstaller --noconfirm --onefile --windowed --name 'MQTT权限迁移审计器' `
    --distpath $dist --workpath $work --specpath $work $source
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller 失败，退出码：$LASTEXITCODE"
}

$built = Join-Path $dist 'MQTT权限迁移审计器.exe'
if (-not (Test-Path -LiteralPath $built -PathType Leaf)) {
    throw "PyInstaller 未生成 EXE：$built"
}
Copy-Item -LiteralPath $built -Destination $output -Force
Write-Host "已生成：$output"
