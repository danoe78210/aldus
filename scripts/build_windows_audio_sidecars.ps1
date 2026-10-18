$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$targetTriple = "x86_64-pc-windows-msvc"
$binaryDirectory = Join-Path $repoRoot "src-tauri\binaries"
$buildRoot = Join-Path $env:RUNNER_TEMP "aldus-audio-sidecars"
$distDirectory = Join-Path $buildRoot "dist"
$workDirectory = Join-Path $buildRoot "pyinstaller"
$ffmpegArchive = Join-Path $buildRoot "ffmpeg.zip"
$ffmpegExtract = Join-Path $buildRoot "ffmpeg"
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-16-13-04/ffmpeg-n8.1.3-18-g46d899d7a0-win64-lgpl-8.1.zip"
$ffmpegLicenseUrl = "https://raw.githubusercontent.com/FFmpeg/FFmpeg/46d899d7a0/COPYING.LGPLv2.1"
$ffmpegSha256 = "186cb8509a86ca2eb6146870661b69a224ccd486f384f6a5f441fa775f79cc04"

New-Item -ItemType Directory -Force -Path $binaryDirectory, $buildRoot, $distDirectory, $workDirectory | Out-Null

python -m pip install --disable-pip-version-check --index-url https://download.pytorch.org/whl/cpu torch==2.2.2+cpu torchaudio==2.2.2+cpu
if ($LASTEXITCODE -ne 0) { throw "PyTorch CPU installation failed." }

python -m pip install --disable-pip-version-check --prefer-binary -r (Join-Path $repoRoot "scripts\requirements-xtts.txt") "numpy<2" pyinstaller==6.14.2
if ($LASTEXITCODE -ne 0) { throw "XTTS and PyInstaller dependency installation failed." }

$pyInstallerArgs = @(
    "--noconfirm",
    "--clean",
    "--onefile",
    "--console",
    "--name", "aldus-audio-server",
    "--distpath", $distDirectory,
    "--workpath", $workDirectory,
    "--specpath", $workDirectory,
    "--runtime-tmpdir", "python-runtime",
    "--collect-all", "TTS",
    "--collect-all", "trainer",
    "--collect-all", "coqpit",
    "--collect-all", "torch",
    "--collect-all", "torchaudio",
    "--collect-all", "transformers",
    "--collect-all", "librosa",
    "--collect-all", "pydub",
    "--collect-all", "fastapi",
    "--collect-all", "uvicorn",
    "--collect-all", "inflect",
    "--collect-all", "typeguard",
    "--collect-all", "gruut",
    "--copy-metadata", "gruut",
    "--hidden-import", "TTS.tts.models.xtts",
    (Join-Path $repoRoot "scripts\xtts_wrapper.py")
)
python -m PyInstaller @pyInstallerArgs
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed to freeze the XTTS sidecar." }

$sidecarExecutable = Join-Path $distDirectory "aldus-audio-server.exe"
$archiveEntries = python -c 'from PyInstaller.archive.readers import CArchiveReader; import sys; print("\n".join(CArchiveReader(sys.argv[1]).toc))' $sidecarExecutable
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the frozen XTTS sidecar archive." }
$hasGruutVersion = $archiveEntries | Where-Object { $_.Replace("\", "/") -eq "gruut/VERSION" }
if (-not $hasGruutVersion) { throw "The frozen XTTS sidecar is missing gruut/VERSION." }

Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegArchive
$actualSha256 = (Get-FileHash -LiteralPath $ffmpegArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $ffmpegSha256) {
    throw "FFmpeg checksum mismatch. Expected $ffmpegSha256, got $actualSha256."
}
Expand-Archive -LiteralPath $ffmpegArchive -DestinationPath $ffmpegExtract -Force
$ffmpegExecutable = Get-ChildItem -LiteralPath $ffmpegExtract -Filter "ffmpeg.exe" -File -Recurse | Select-Object -First 1
if (-not $ffmpegExecutable) { throw "ffmpeg.exe was not found in the pinned FFmpeg archive." }

Copy-Item -LiteralPath (Join-Path $distDirectory "aldus-audio-server.exe") -Destination (Join-Path $binaryDirectory "aldus-audio-server-$targetTriple.exe") -Force
Copy-Item -LiteralPath $ffmpegExecutable.FullName -Destination (Join-Path $binaryDirectory "ffmpeg-$targetTriple.exe") -Force
Invoke-WebRequest -Uri $ffmpegLicenseUrl -OutFile (Join-Path $binaryDirectory "FFmpeg-LGPLv2.1.txt")

& (Join-Path $binaryDirectory "ffmpeg-$targetTriple.exe") -version | Select-Object -First 1
if ($LASTEXITCODE -ne 0) { throw "The packaged FFmpeg executable failed its smoke check." }
Get-ChildItem -LiteralPath $binaryDirectory -Filter "*-$targetTriple.exe" | Select-Object Name, Length
