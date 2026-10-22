import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {databaseConfig} from '../../tools/market-db/connection.mjs';
const exec=promisify(execFile);
export async function fixture(){
  const key=randomBytes(8).toString('hex'),name='atlas-db-test-'+key,network=name+'-net',password=randomBytes(24).toString('hex');let createdNetwork=false,createdContainer=false,admin;
  const docker=async(args,options={})=>{try{return(await exec('docker',args,{timeout:30000,maxBuffer:1024*1024,...options})).stdout.trim();}catch{throw new Error('OWNED_POSTGRES_DOCKER_COMMAND_FAILED');}};
  const stop=async()=>{await admin?.end().catch(()=>{});
    if(createdContainer){const owner=await docker(['inspect','--format','{{ index .Config.Labels "atlas.fixture" }}',name]);if(owner!==key)throw new Error('FIXTURE_OWNERSHIP_MISMATCH');await docker(['stop','--time','5',name]);}
    if(createdNetwork)await docker(['network','rm',network]);
  };
  try{
    const version=await docker(['version','--format','{{.Server.Version}}']);if(Number(version.split('.')[0])<28)throw new Error('FIXTURE_REQUIRES_DOCKER_28');
    await docker(['network','create','--opt','com.docker.network.bridge.gateway_mode_ipv4=nat','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','--label','atlas.fixture='+key,network]);createdNetwork=true;
    await docker(['run','--detach','--rm','--pull','never','--name',name,'--label','atlas.fixture='+key,'--network',network,'--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw','--env','PGDATA=/var/lib/postgresql/data/pgdata','--env','POSTGRES_PASSWORD','postgres:17-alpine'],{env:{...process.env,POSTGRES_PASSWORD:password}});createdContainer=true;
    const info=JSON.parse(await docker(['inspect','--format','{{json .NetworkSettings.Ports}}',name])),ports=info['5432/tcp'];
    if(ports?.length!==1||ports[0].HostIp!=='127.0.0.1')throw new Error('FIXTURE_LOOPBACK_REQUIRED '+JSON.stringify(info));
    const peers=JSON.parse(await docker(['network','inspect','--format','{{json .Containers}}',network]));if(Object.keys(peers).length!==1||Object.values(peers)[0].Name!==name)throw new Error('FIXTURE_DEDICATED_NETWORK_REQUIRED');
    const port=ports[0].HostPort,url=user=>`postgresql://${user}:${password}@127.0.0.1:${port}/postgres`;
    let ready=false;
    for(let i=0;i<60;i++){
      const client=new pg.Client({...databaseConfig(url('postgres')),connectionTimeoutMillis:400});client.on('error',()=>{});
      try{await client.connect();await client.query('SELECT 1');admin=client;ready=true;break;}catch{await client.end().catch(()=>{});await delay(100);}
    }
    if(!ready)throw new Error('FIXTURE_START_TIMEOUT');
    return {admin,url,async createUser(role){if(!/^atlas_test_[a-z]+$/.test(role))throw new Error('INVALID_TEST_ROLE');await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);return url(role);},stop};
  }catch(error){await stop();throw error;}
}
