# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['windows_client_entry.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'psycopg2',
        'psycopg2.pool',
        'psycopg2.extras',
        'win32gui',
        'win32process',
        'win32api',
        'win32con',
        'psutil',
        'sqlite3',
        'PIL',
        'PIL.Image',
        'PIL.ImageGrab',
        'pynput',
        'pynput.keyboard',
        'win32clipboard',
    ],

    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ParentalScreenTracker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
