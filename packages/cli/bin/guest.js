import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export const CLI_VERSION=JSON.parse(fs.readFileSync(fileURLToPath(new URL("../package.json",import.meta.url)),"utf8")).version;
const flag=(parsed,name)=>parsed.flags[name]??parsed.flags[name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function guestApi(options) {
  const url=new URL(options.baseUrl??"https://api.init.computer");
  if(url.username||url.password||(url.protocol!=="https:"&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error("Use an HTTPS Init API origin, or localhost for development.");
  return async (route,body,extra={})=> {
    const response=await fetch(new URL(route,url),{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(options.apiKey?{Authorization:`Bearer ${options.apiKey}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60_000),redirect:'error',...extra});
    const payload=await response.json();
    if(!response.ok){const detail=payload.errors?.[0];const error=new Error(detail?.message??`Init request failed (${response.status}).`);error.code=detail?.code;error.status=response.status;throw error;}
    return payload.result??payload;
  };
}

async function installCli(configDir) {
  const packageName=`@init-computer/cli@${CLI_VERSION}`;
  const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js')];
  const npm=candidates.find(candidate=>candidate&&fs.existsSync(candidate)&&path.basename(candidate)==='npm-cli.js');
  if(!npm) throw new Error("npm is required. Install Node.js with npm, then run setup again.");
  let local=false;
  try { await exec(process.execPath,[npm,'install','--global',packageName],{timeout:180_000,maxBuffer:1024*1024,windowsHide:true}); }
  catch(error) {
    if(!/EACCES|EPERM|permission/i.test(`${error.stderr??''} ${error.message}`)) throw new Error("CLI installation failed. Check npm access and retry; no guest trial has been created.");
    local=true;
    await exec(process.execPath,[npm,'install','--global','--prefix',path.join(configDir,'cli'),packageName],{timeout:180_000,maxBuffer:1024*1024,windowsHide:true});
  }
  const prefix=local?path.join(configDir,'cli'):(await exec(process.execPath,[npm,'prefix','--global'],{windowsHide:true})).stdout.trim();
  const script=path.join(prefix,...(process.platform==='win32'?[]:['lib']),'node_modules','@init-computer','cli','bin','init.js');
  if(!fs.existsSync(script)) throw new Error("npm completed but the installed Init CLI could not be verified.");
  const verified=await exec(process.execPath,[script,'--version'],{timeout:15_000,windowsHide:true});
  if(verified.stdout.trim()!==CLI_VERSION)throw new Error("Installed Init CLI version did not match the requested release.");
  return {command:process.execPath,args:[script],installedVersion:CLI_VERSION,installation:local?'user':'global'};
}

export async function setupGuest(parsed,io) {
  fs.mkdirSync(io.configDir,{recursive:true,mode:0o700});
  const lock=path.join(io.configDir,'setup.lock');
  let fd;
  for(let i=0;i<300;i++) {
    try {fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,String(process.pid));break;}
    catch(error){if(error.code!=='EEXIST')throw error;
      try {const pid=Number(fs.readFileSync(lock,'utf8'));process.kill(pid,0);} catch(error){if(error.code==='ESRCH'){fs.unlinkSync(lock);continue;}}
      await sleep(100);
    }
  }
  if(fd===undefined)throw new Error("Another Init setup is running. Retry when it finishes.");
  try {
    let config=io.readConfig();
    let executable=config.executable;
    if(flag(parsed,'install-cli')&&(!executable||executable.installedVersion!==CLI_VERSION||!fs.existsSync(executable.args?.[0]??''))) executable=await installCli(io.configDir);
    const baseUrl=flag(parsed,'base-url')||process.env.INIT_API_BASE_URL||config.baseUrl||'https://api.init.computer';
    const existing=flag(parsed,'api-key')||process.env.INIT_API_KEY||io.localKey()||config.apiKey;
    if(existing){const result=await guestApi({baseUrl,apiKey:existing})('/v1/identity');io.writeConfig({...config,executable});return {...result,executable,reused:true};}
    if(!parsed.flags.guest)throw new Error("Use init setup --guest to connect without signing up.");
    // Persist proof before bootstrap; only possession of this secret can resume a lost response.
    const pending=config.pendingGuest??{credential:`init_guest_${crypto.randomBytes(32).toString('hex')}`,installationId:crypto.randomUUID()};
    io.writeConfig({...config,pendingGuest:pending,executable});
    const result=await guestApi({baseUrl})('/v1/guest/sessions',pending);
    const {pendingGuest,...rest}=io.readConfig();
    io.writeConfig({...rest,apiKey:pending.credential,baseUrl,identityType:'guest',workspaceId:result.workspaceId,executable});
    const verified=await guestApi({baseUrl,apiKey:pending.credential})('/v1/identity');
    return {...verified,executable,reused:false,nextCommands:['init usage --json','init generate "Describe your endpoint" --json','init public inspect <slug> --json']};
  } finally {fs.closeSync(fd);fs.unlinkSync(lock);}
}

export async function claimGuest(parsed,io,options) {
  const api=guestApi(options),config=io.readConfig();
  let handoff=config.pendingClaim;
  if(!handoff){handoff=await api('/v1/guest/claim',{});io.writeConfig({...config,pendingClaim:{...handoff,newCredential:`init_sk_${crypto.randomBytes(32).toString('hex')}`}});handoff=io.readConfig().pendingClaim;}
  const url=new URL(handoff.url);
  if(!['init.computer','www.init.computer'].includes(url.hostname)||url.protocol!=='https:')throw new Error("Unexpected claim destination.");
  if(parsed.flags.open!==false&&!parsed.flags['no-open']) {
    const [command,args]=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url.href]]:process.platform==='darwin'?['open',[url.href]]:['xdg-open',[url.href]];
    await exec(command,args,{windowsHide:true}).catch(()=>{});
  }
  process.stderr.write(`Claim your workspace: ${url.href}\nConfirm in your browser and add credit, then return here.\n`);
  const poll=async()=>api('/v1/guest/claim/poll',{claimId:handoff.claimId,pollSecret:handoff.pollSecret,newCredential:handoff.newCredential});
  const deadline=Date.now()+(parsed.flags.wait?Math.min(900,Number(parsed.flags.wait))*1000:0);
  let result=await poll();
  while(result.status==='pending'&&Date.now()<deadline){await sleep(2000);result=await poll();}
  if(result.status==='claimed') {
    const {pendingClaim,...rest}=io.readConfig();
    io.writeConfig({...rest,apiKey:handoff.newCredential,identityType:'account',workspaceId:result.workspaceId});
  }
  return result.status==='pending'?{...result,url:result.url??url.href,nextCommand:'init claim --wait 60 --json'}:result;
}

export async function publicCommand(parsed,options) {
  const action=parsed.positionals[1],slug=parsed.positionals[2];
  if(!['inspect','use'].includes(action)||!/^[a-z0-9-]+$/.test(slug??''))throw new Error("Use init public inspect <slug> or init public use <slug>.");
  return guestApi(options)(`/v1/public/${slug}/${action}`,action==='use'?{}:undefined);
}
