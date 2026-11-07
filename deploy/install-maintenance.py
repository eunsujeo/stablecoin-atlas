#!/usr/bin/python3
# One-time operator installation. No password storage, arbitrary sudo or home-script grants.
import os, stat, hashlib, pathlib, subprocess, tempfile
PINS = {'finish-yahoo-fx.sh': '5a4a0fe4ad21c0e28fa6f5805a788d98bb97f579f405761e1d03c0e0ce337313', 'maintenance.mjs': 'bf73247ddbaaa4649e35903dcc7bf57aa03f8bf2e56f67c79278a5d1c2645527', 'atlas-maintenance': '727b754d8034b7881ea21d4dec45e901807a82b047624fd94b3b001f82863c2a', 'maintenance-idle.mjs': '8daa6607f31738bce8e52ee978a9d40e5af338ee848ac5128fa2a0e3e7de2844', 'atlas-maintenance.sudoers': 'eee0294581a93ed3058a7f8bb441b177368141e1f40858a7809264c9d2fe15fa'}
SOURCE = pathlib.Path('/home/mob/atlas-maintenance-prepared-20261107')
BASE = pathlib.Path('/usr/local/libexec/atlas-maintenance')

def trusted_directory(path,create=False):
    if path.parent!=path: trusted_directory(path.parent,create)
    try:s=path.lstat()
    except FileNotFoundError:
        if not create:raise
        path.mkdir(mode=0o755);s=path.lstat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o022:raise RuntimeError('UNTRUSTED_DIRECTORY')

def digest(b):return hashlib.sha256(b).hexdigest()
def read_regular(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        s=os.fstat(fd)
        if not stat.S_ISREG(s.st_mode) or s.st_size>65536:raise RuntimeError('INPUT_INVALID')
        with os.fdopen(os.dup(fd),'rb') as f:return f.read(65537)
    finally:os.close(fd)

def publish(source,target,mode):
    trusted_directory(target.parent)
    try:
        s=target.lstat()
        if not stat.S_ISREG(s.st_mode) or s.st_uid!=0 or stat.S_IMODE(s.st_mode)!=mode or read_regular(target)!=read_regular(source):raise RuntimeError('EXISTING_FILE_DIFFERS')
        return
    except FileNotFoundError:pass
    os.chmod(source,mode)
    os.link(source,target) # exclusive publication, no overwrite
    os.unlink(source)
    fd=os.open(target.parent,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)

if os.geteuid()!=0:raise SystemExit('Run this once in the root terminal.')
os.umask(0o077)
trusted_directory(BASE,True)
trusted_directory(pathlib.Path('/usr/local/bin'))
trusted_directory(pathlib.Path('/etc/sudoers.d'))
subprocess.run(['/usr/sbin/visudo','-c'],check=True)
with tempfile.TemporaryDirectory(prefix='.install-',dir=BASE) as name:
    stage=pathlib.Path(name)
    for filename,pin in PINS.items():
        data=read_regular(SOURCE/filename)
        if digest(data)!=pin:raise RuntimeError('PREPARED_HASH_MISMATCH')
        target=stage/filename
        with target.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        if digest(read_regular(target))!=pin:raise RuntimeError('STAGING_HASH_MISMATCH')
    subprocess.run(['/usr/sbin/visudo','-cf',str(stage/'atlas-maintenance.sudoers')],check=True)
    subprocess.run(['/usr/bin/bash','-n',str(stage/'atlas-maintenance')],check=True)
    subprocess.run(['/usr/bin/bash','-n',str(stage/'finish-yahoo-fx.sh')],check=True)
    for filename in ['maintenance.mjs','maintenance-idle.mjs']:
        subprocess.run(['/usr/bin/node','--check',str(stage/filename)],check=True)
    for filename in ['maintenance.mjs','maintenance-idle.mjs','finish-yahoo-fx.sh']:
        publish(stage/filename,BASE/filename,0o644)
    publish(stage/'atlas-maintenance',pathlib.Path('/usr/local/bin/atlas-maintenance'),0o755)
    publish(stage/'atlas-maintenance.sudoers',pathlib.Path('/etc/sudoers.d/atlas-maintenance'),0o440)
subprocess.run(['/usr/sbin/visudo','-c'],check=True)
print('ATLAS_MAINTENANCE_REGISTERED: only five fixed commands; no password saved.')
