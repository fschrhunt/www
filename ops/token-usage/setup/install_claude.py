#!/usr/bin/env python3
"""Install usage collection for a private device inventory over existing SSH trust."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import sys
import subprocess

SOURCE = Path(__file__).resolve().parents[1] / "runtime"
# Provision only previously trusted hosts and never forward the operator's agent.
SSH = ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
       "-o", "ForwardAgent=no", "-o", "ConnectTimeout=10"]


def remote(host, script, payload, sudo=False):
    """Send configuration through stdin without exposing private key material."""
    command = ('sudo -n ' if sudo else '') + 'python3 -c ' + shlex.quote(script)
    result = subprocess.run([*SSH, host, command],
                            input=json.dumps(payload), text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError('Remote installation failed; inspect the destination privately.')
    return json.loads(result.stdout)


CLIENT = r'''
import json,pathlib,os,subprocess,sys,hashlib,pwd
p=json.load(sys.stdin)
state=pathlib.Path.home()/'.local/share/token-usage/claude'
state.mkdir(parents=True,exist_ok=True,mode=0o700)
os.chmod(state,0o700)
runtime=state/'releases'/p['release'];runtime.mkdir(parents=True,exist_ok=True,mode=0o700)
for name,content in p['files'].items():
 f=runtime/name;f.write_text(content);os.chmod(f,0o600)
link=state/'current.next'
if link.is_symlink():link.unlink()
link.symlink_to('releases/'+p['release']);os.replace(link,state/'current')
if not (state/'upload-key').exists():
 subprocess.run(['/usr/bin/ssh-keygen','-q','-t','ed25519','-N','','-C','claude-usage-'+p['device'],'-f',str(state/'upload-key')],check=True,stdout=subprocess.DEVNULL)
(state/'known_hosts').write_text(p['host']+' '+p['hostkey']+'\n')
(state/'config.json').write_text(json.dumps({'host':p['host'],'port':22})+'\n')
for name in ['known_hosts','config.json']:os.chmod(state/name,0o600)
print(json.dumps({'publicKey':(state/'upload-key.pub').read_text().strip(),'state':str(state),'python':sys.executable,'uid':os.getuid(),'user':pwd.getpwuid(os.getuid()).pw_name}))
'''

RECEIVER = r'''
import json,pathlib,os,subprocess,pwd,grp,shutil,sys
p=json.load(sys.stdin)
try:pwd.getpwnam('usage-ingest')
except KeyError:subprocess.run(['useradd','--system','--create-home','--home-dir','/var/lib/usage-ingest','--shell','/bin/sh','usage-ingest'],check=True)
subprocess.run(['usermod','-a','-G','token-usage','usage-ingest'],check=True)
account=pwd.getpwnam('usage-ingest')
root=pathlib.Path('/srv/apps/token-usage')
release=root/'releases'/p['release']
if not release.exists():shutil.copytree((root/'current').resolve(),release)
gid=grp.getgrnam('token-usage').gr_gid
os.chown(release,0,gid);os.chmod(release,0o750)
for existing in release.rglob('*'):
 os.chown(existing,0,gid);os.chmod(existing,0o750 if existing.is_dir() else 0o640)
for name,content in p['files'].items():
 f=release/name;f.write_text(content);os.chown(f,0,gid);os.chmod(f,0o640)
link=root/'current.next'
if link.is_symlink():link.unlink()
link.symlink_to('releases/'+p['release']);os.replace(link,root/'current')
data=root/'shared/claude';data.mkdir(exist_ok=True,mode=0o700);os.chown(data,account.pw_uid,account.pw_gid);os.chmod(data,0o700)
home=pathlib.Path(account.pw_dir);os.chown(home,0,0);os.chmod(home,0o755)
ssh=home/'.ssh';ssh.mkdir(exist_ok=True,mode=0o755);os.chown(ssh,0,0);os.chmod(ssh,0o755)
keys=[]
for device,key in p['keys'].items():
 command='/usr/bin/python3 -B /srv/apps/token-usage/current/claude_ingest.py --data /srv/apps/token-usage/shared/claude --device '+device
 keys.append('restrict,command="'+command+'" '+key)
f=ssh/'authorized_keys';f.write_text('\n'.join(keys)+'\n');os.chown(f,0,0);os.chmod(f,0o644)
print(json.dumps({'installed':True}))
'''

MAC_JOB = r'''
import json,pathlib,plistlib,subprocess,sys
p=json.load(sys.stdin)
state=pathlib.Path(p['state'])
label='com.fischer.token-usage.claude'
job={'Label':label,'ProgramArguments':[p['python'],'-B',str(state/'current/claude_local.py'),'--state',str(state)],
 'StartInterval':300,'RunAtLoad':True,'ProcessType':'Background','Nice':10,'LowPriorityIO':True,
 'StandardOutPath':'/dev/null','StandardErrorPath':'/dev/null'}
f=pathlib.Path.home()/'Library/LaunchAgents'/ (label+'.plist');f.parent.mkdir(parents=True,exist_ok=True)
f.write_bytes(plistlib.dumps(job))
domain='gui/'+str(p['uid'])
subprocess.run(['launchctl','bootout',domain+'/'+label],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['launchctl','bootstrap',domain,str(f)],check=True)
print(json.dumps({'scheduled':True}))
'''

SERVER_JOB = r'''
import json,pathlib,subprocess,sys
p=json.load(sys.stdin)
state=p['state']
service=''' + repr('''[Unit]
Description=Queue and upload local Claude token counters
After=network-online.target
[Service]
Type=oneshot
User=COLLECTOR_USER
ExecStart=/usr/bin/python3 -B STATE/current/claude_local.py --state STATE
UMask=0077
Nice=10
CPUQuota=10%
MemoryMax=128M
TimeoutStartSec=90
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=STATE
PrivateTmp=yes
PrivateDevices=yes
CapabilityBoundingSet=
RestrictSUIDSGID=yes
StandardOutput=null
''') + r'''
service=service.replace('STATE',state).replace('COLLECTOR_USER',p['user'])
root=pathlib.Path('/etc/systemd/system')
(root/'token-usage-claude-local.service').write_text(service)
(root/'token-usage-claude-local.timer').write_text('[Unit]\nDescription=Collect local Claude usage every five minutes\n[Timer]\nOnCalendar=*:0/5\nRandomizedDelaySec=30\nPersistent=true\n[Install]\nWantedBy=timers.target\n')
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','token-usage-claude-local.timer'],check=True,stderr=subprocess.DEVNULL)
print(json.dumps({'scheduled':True}))
'''


def load_inventory(path):
    """Validate the complete private sender inventory before opening any SSH connection."""
    inventory = json.loads(path.read_text())
    host_pattern = r"[A-Za-z0-9_][A-Za-z0-9_.@:-]*"
    if not re.fullmatch(host_pattern, inventory.get("server", "")):
        raise ValueError("Provide a receiver SSH alias in the private inventory.")
    devices = inventory.get("devices")
    if not isinstance(devices, list) or not devices:
        raise ValueError("Provide the complete authorized device list.")
    seen = set()
    for device in devices:
        identity = device.get("id", "")
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", identity) or identity in seen:
            raise ValueError("Device IDs must be unique lowercase names.")
        seen.add(identity)
        host = device.get("host")
        if host is not None and not re.fullmatch(host_pattern, host):
            raise ValueError("Device hosts must be SSH aliases, or null for this machine.")
        if device.get("scheduler") not in ("launchd", "systemd"):
            raise ValueError("Each device needs a launchd or systemd scheduler.")
    return inventory


def run_on(host, script, payload, sudo=False):
    """Run a provisioning step locally or through SSH, keeping payloads off command arguments."""
    if host is not None:
        return remote(host, script, payload, sudo=sudo)
    command = [sys.executable, "-c", script]
    if sudo:
        command = ["sudo", "-n", *command]
    result = subprocess.run(command, input=json.dumps(payload), text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError("Local installation failed; inspect the destination privately.")
    return json.loads(result.stdout)


def main():
    """Provision the configured upload keys and receiver, verify uploads, then schedule senders."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True, help="Private inventory JSON outside the repository")
    inventory = load_inventory(parser.parse_args().config)
    server = inventory["server"]
    host = subprocess.check_output(['ssh','-G',server],text=True,stderr=subprocess.DEVNULL)
    host = next(line.split(' ',1)[1] for line in host.splitlines() if line.startswith('hostname '))
    hostkey = subprocess.check_output([*SSH,server,'cat /etc/ssh/ssh_host_ed25519_key.pub'],text=True,stderr=subprocess.DEVNULL,timeout=30).strip()
    files = {name:(SOURCE/name).read_text() for name in ['claude_local.py','claude_records.py','claude_ingest.py']}
    release = 'claude-'+hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()[:12]
    clients = {}
    for device in inventory['devices']:
        payload = {'device':device['id'],'host':host,'hostkey':hostkey,'release':release,
                   'files':{k:v for k,v in files.items() if k!='claude_ingest.py'}}
        clients[device['id']] = run_on(device.get('host'), CLIENT, payload)
    remote(server,RECEIVER,{'release':release,'files':files,'keys':{k:v['publicKey'] for k,v in clients.items()}},sudo=True)
    # Prove the restricted upload path works before enabling recurring jobs.
    for device in inventory['devices']:
        client = clients[device['id']]
        cmd = [client['python'],'-B',client['state']+'/current/claude_local.py','--state',client['state']]
        if device.get('host') is not None:
            cmd = [*SSH,device['host'],shlex.join(cmd)]
        result = subprocess.run(cmd,capture_output=True,text=True,timeout=90)
        if result.returncode:
            raise RuntimeError('First upload failed; schedules were not updated.')
    for device in inventory['devices']:
        script = MAC_JOB if device['scheduler']=='launchd' else SERVER_JOB
        run_on(device.get('host'), script, clients[device['id']], sudo=device['scheduler']=='systemd')
    print('Scheduled configured devices; release '+release)


if __name__=='__main__':
    main()
