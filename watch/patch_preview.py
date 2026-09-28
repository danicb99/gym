import zipfile
import io
import json
import os
import glob

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

# Find the latest .zab file
zab_files = sorted(glob.glob(os.path.join(dist_dir, "*.zab")), key=os.path.getmtime, reverse=True)
if not zab_files:
    raise FileNotFoundError("No .zab file found in dist!")

latest_zab = zab_files[0]
print(f"Using latest zab: {latest_zab}")

# Extract manifest to find the 466x466 round zpks
with zipfile.ZipFile(latest_zab, 'r') as z:
    manifest_data = json.loads(z.read('manifest.json').decode('utf-8'))
    
nxp_zpk_name = None
zps_zpk_name = None
for zpk_info in manifest_data.get('zpks', []):
    for plat in zpk_info.get('platforms', []):
        if plat.get('screenType') == 'round' and plat.get('screenResolution') == '466x466':
            if plat.get('cpuPlatform') == 'NXP':
                nxp_zpk_name = zpk_info['name']
            elif plat.get('cpuPlatform') == 'ZPS':
                zps_zpk_name = zpk_info['name']

print(f"NXP round 466 zpk: {nxp_zpk_name}")
print(f"ZPS round 466 zpk: {zps_zpk_name}")

with zipfile.ZipFile(latest_zab, 'r') as z:
    if nxp_zpk_name:
        nxp_bytes = z.read(nxp_zpk_name)
        nxp_patched = patch_zpk(nxp_bytes)
        with open(os.path.join(dist_dir, 'vigorexiapp_active2.zpk'), 'wb') as f:
            f.write(nxp_patched)
        print("Written vigorexiapp_active2.zpk")
        
    if zps_zpk_name:
        zps_bytes = z.read(zps_zpk_name)
        zps_patched = patch_zpk(zps_bytes)
        with open(os.path.join(dist_dir, 'vigorexiapp_active2_zps.zpk'), 'wb') as f:
            f.write(zps_patched)
        print("Written vigorexiapp_active2_zps.zpk")

    # Patch the whole bundle
    zab_out_buf = io.BytesIO()
    with zipfile.ZipFile(zab_out_buf, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in z.infolist():
            content = z.read(item.filename)
            if item.filename.endswith('.zpk'):
                print(f"Patching bundle zpk: {item.filename}")
                content = patch_zpk(content)
            zout.writestr(item, content)

    with open(os.path.join(dist_dir, 'vigorexiapp.zpk'), 'wb') as f:
        f.write(zab_out_buf.getvalue())
    print("Updated vigorexiapp.zpk (full bundle)")
