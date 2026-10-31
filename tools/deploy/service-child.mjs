import {randomUUID} from 'node:crypto';
import {requireThat} from './files.mjs';
// PID 1 establishes the service identity; the broker never reacquires dropped capabilities.
export function serviceChildCommand({user,command,args,cwd,hold=false,proxy=false}){
 const build=user==='atlasbuild';
 requireThat((build||['atlasweb','atlascollector'].includes(user))&&command===(build?'/usr/bin/git':'/usr/bin/node')&&cwd===(build?'/var/cache/atlas-build':'/usr/local/lib/atlas-deploy')&&(!proxy||build)&&(!hold||!build),'CHILD_SERVICE_INVALID');
 requireThat(Array.isArray(args)&&args.every(v=>typeof v==='string'&&!v.includes('\0')),'CHILD_SERVICE_INVALID');
 const seconds=hold?1800:build?30:120;
 const properties=['User='+user,'Group='+user,'WorkingDirectory='+cwd,'NoNewPrivileges=true','CapabilityBoundingSet=','ProtectSystem=strict','ProtectHome=true','PrivateTmp=true','PrivateDevices=true','ProtectKernelTunables=true','ProtectKernelModules=true','ProtectControlGroups=true','RestrictSUIDSGID=true','RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6','KillMode=control-group','RuntimeMaxSec='+seconds,'MemoryMax='+ (build?'128M':'512M'),'CPUQuota=100%','TasksMax=32','UMask=0077',...(proxy?['EnvironmentFile=-/etc/atlas-deploy/proxy.env']:[])];
 return {command:'/usr/bin/systemd-run',args:['--quiet','--wait','--pipe','--collect','--service-type=exec','--unit=atlas-deploy-child-'+user+'-'+randomUUID(),...properties.map(p=>'--property='+p),...['PATH=/usr/bin:/bin','NODE_OPTIONS=','NODE_PATH=','NODE_TLS_REJECT_UNAUTHORIZED=1','GIT_CONFIG_GLOBAL=/dev/null','GIT_TERMINAL_PROMPT=0'].map(p=>'--setenv='+p),command,...args],options:{cwd:'/usr/local/lib/atlas-deploy',env:{PATH:'/usr/bin:/bin'},timeout:(seconds+5)*1000,maxBuffer:65536}};
}
