# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all, collect_data_files

# Collect pymobiledevice3 data files (pair records, tunnel drivers, etc.)
pmd3_datas, pmd3_binaries, pmd3_hiddenimports = collect_all('pymobiledevice3')

a = Analysis(
    ['src/main.py'],
    pathex=[],
    binaries=pmd3_binaries,
    datas=[
        ('src/templates', 'templates'),
        ('BROADCAST', '.'),
        ('CURRENT_VERSION', '.'),
        *pmd3_datas,
    ],
    hiddenimports=[
        *pmd3_hiddenimports,
        'pymobiledevice3',
        'pymobiledevice3.services.dvt.instruments.dvt_provider',
        'pymobiledevice3.services.dvt.instruments.location_simulation',
        'pymobiledevice3.remote.remote_service_discovery',
        'pymobiledevice3.remote.tunnel_service',
        'pymobiledevice3.remote.utils',
        'pymobiledevice3.lockdown',
        'pymobiledevice3.usbmux',
        'pymobiledevice3.services.amfi',
        'flask',
        'flask.templating',
        'jinja2',
        'jinja2.ext',
        'psutil',
        'pycountry',
        'requests',
        'cryptography',
        'zeroconf',
        'asyncio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='GeoPort',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,      # set False to hide terminal window (macOS)
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

# macOS: wrap into .app bundle
app = BUNDLE(
    exe,
    name='GeoPort.app',
    icon=None,
    bundle_identifier='me.geoport.app',
    info_plist={
        'NSHighResolutionCapable': True,
        'LSUIElement': False,
    },
)
