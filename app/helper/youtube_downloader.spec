# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


project_root = Path(SPECPATH).resolve().parents[1]
helper_root = project_root / "app" / "helper"
package_root = helper_root / "yt_helper"

datas = [(str(package_root / "static"), "yt_helper/static")]
datas += collect_data_files("yt_dlp")
datas += collect_data_files("imageio_ffmpeg")

hiddenimports = collect_submodules("yt_dlp")
hiddenimports += collect_submodules("imageio_ffmpeg")

block_cipher = None


a = Analysis(
    [str(helper_root / "run_helper.py")],
    pathex=[str(helper_root), str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="YouTubeDownloaderHelper",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="YouTubeDownloaderHelper",
)
