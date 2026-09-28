import zipfile
import io
import json
import os

dist_dir = r"c:\_DESARROLLO\VIGOREXIAPP_DEV\watch\dist"

def patch_inner_zip(zip_bytes):
    in_buf = io.BytesIO(zip_bytes)
    out_buf = io.BytesIO()
    with zipfile.ZipFile(in_buf, 'r') as zin, zipfile.ZipFile(out_buf, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename == 'app.json':
                try:
                    data = json.loads(content.decode('utf-8'))
                    if 'packageInfo' in data:
                        data['packageInfo']['mode'] = 'preview'
                    else:
                        data['packageInfo'] = {'mode': 'preview'}
                    content = json.dumps(data, separators=(',', ':')).encode('utf-8')
                    print(f"  Patched app.json in inner zip, mode is now: {data['packageInfo']['mode']}")
                except Exception as e:
                    print(f"  Error parsing app.json: {e}")
            zout.writestr(item, content)
    return out_buf.getvalue()

def patch_zpk(zpk_bytes):
    in_buf = io.BytesIO(zpk_bytes)
    out_buf = io.BytesIO()
    with zipfile.ZipFile(in_buf, 'r') as zin, zipfile.ZipFile(out_buf, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename in ('device.zip', 'app-side.zip'):
                print(f" Patching {item.filename} inside zpk...")
                content = patch_inner_zip(content)
            elif item.filename == 'app.json':
                try:
                    data = json.loads(content.decode('utf-8'))
                    data.setdefault('packageInfo', {})['mode'] = 'preview'
                    content = json.dumps(data, separators=(',', ':')).encode('utf-8')
                    print(" Patched top-level app.json in zpk")
                except Exception as e:
                    print(f" Error: {e}")
            zout.writestr(item, content)
    return out_buf.getvalue()

# 1. Patch the round 466x466 NXP zpk (Amazfit Active 2)
active2_nxp_src = os.path.join(dist_dir, '7031473fd8a886324d1a97c6d6bc3f26.zpk')
with open(active2_nxp_src, 'rb') as f:
    active2_nxp_patched = patch_zpk(f.read())

active2_out = os.path.join(dist_dir, 'vigorexiapp_active2.zpk')
with open(active2_out, 'wb') as f:
    f.write(active2_nxp_patched)
print(f"Created {active2_out} ({len(active2_nxp_patched)} bytes)")

# 2. Patch the round 466x466 ZPS zpk
active2_zps_src = os.path.join(dist_dir, '3be8030fdfef289291651bf777a2ae43.zpk')
with open(active2_zps_src, 'rb') as f:
    active2_zps_patched = patch_zpk(f.read())
active2_zps_out = os.path.join(dist_dir, 'vigorexiapp_active2_zps.zpk')
with open(active2_zps_out, 'wb') as f:
    f.write(active2_zps_patched)
print(f"Created {active2_zps_out} ({len(active2_zps_patched)} bytes)")

# 3. Patch the full bundle zab / vigorexiapp.zpk
zab_src = os.path.join(dist_dir, '33112-VigorexiApp-1.0.0-20260928141525.zab')
zab_out_buf = io.BytesIO()
with zipfile.ZipFile(zab_src, 'r') as zin, zipfile.ZipFile(zab_out_buf, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        content = zin.read(item.filename)
        if item.filename.endswith('.zpk'):
            print(f"Patching bundle zpk: {item.filename}")
            content = patch_zpk(content)
        zout.writestr(item, content)

zab_patched_bytes = zab_out_buf.getvalue()
bundle_out = os.path.join(dist_dir, 'vigorexiapp.zpk')
with open(bundle_out, 'wb') as f:
    f.write(zab_patched_bytes)
print(f"Updated {bundle_out} ({len(zab_patched_bytes)} bytes)")
