import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);const full=args.includes('--full');const spec=args.find(a=>!a.startsWith('--'));
if(!spec)throw new Error('Usage: npm run release -- <major|minor|patch|x.y.z>');
function run(cmd,a=[],opts={}){const r=spawnSync(cmd,a,{cwd:ROOT,encoding:'utf8',stdio:opts.capture?'pipe':'inherit'});if(r.status!==0)throw new Error(`${cmd} ${a.join(' ')} failed`);return opts.capture?String(r.stdout||'').trim():'';}
function currentVersion(){return JSON.parse(fs.readFileSync(path.join(ROOT,'version.json'),'utf8')).version;}
function bump(v,kind){const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(v);if(!m)throw new Error(`Cannot ${kind}-bump non-stable version ${v}`);let [M,mn,p]=m.slice(1).map(Number);if(kind==='major'){M++;mn=0;p=0;}else if(kind==='minor'){mn++;p=0;}else p++;return`${M}.${mn}.${p}`;}
const old=currentVersion();const next=['major','minor','patch'].includes(spec)?bump(old,spec):spec;
if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(next))throw new Error(`Invalid release version: ${next}`);
if(next===old)throw new Error(`version.json is already ${next}`);
if(run('git',['rev-parse','--abbrev-ref','HEAD'],{capture:true})!=='main')throw new Error('Releases must be created from main.');
if(run('git',['status','--porcelain'],{capture:true}))throw new Error('Working tree must be clean before release. Commit feature work first.');
run('git',['fetch','origin','main','--tags']);
const local=run('git',['rev-parse','HEAD'],{capture:true}),remote=run('git',['rev-parse','origin/main'],{capture:true});
if(local!==remote)throw new Error('Local main must exactly match origin/main before release.');
const versionPath=path.join(ROOT,'version.json');const oldText=fs.readFileSync(versionPath,'utf8');
let committed=false;
try{
  fs.writeFileSync(versionPath,JSON.stringify({version:next},null,2)+'\n');
  run('npm',['run','verify']);
  if(full){
    const check=spawnSync('firebase',['--version'],{cwd:ROOT,encoding:'utf8'});if(check.status!==0)throw new Error('Firebase CLI is required for release:full.');
    run('firebase',['use','milkflow-pumping-dashboard','--non-interactive']);
    run('firebase',['deploy','--only','functions','--project','milkflow-pumping-dashboard','--non-interactive']);
  }
  run('git',['add','version.json']);
  run('git',['commit','-m',`Release v${next}`]);committed=true;
  const sha=run('git',['rev-parse','HEAD'],{capture:true});
  run('git',['tag','-a',`v${next}`,'-m',`MilkFlow v${next}`]);
  run('git',['push','origin','main']);run('git',['push','origin',`v${next}`]);
  console.log(`Released MilkFlow v${next} at ${sha}`);
  const gh=spawnSync('gh',['--version'],{cwd:ROOT,encoding:'utf8'});
  if(gh.status===0){
    let runId='';
    for(let i=0;i<30&&!runId;i++){
      const q=spawnSync('gh',['run','list','--workflow','pages.yml','--branch','main','--limit','5','--json','databaseId,headSha'],{cwd:ROOT,encoding:'utf8'});
      if(q.status===0){try{const rows=JSON.parse(q.stdout||'[]');runId=String(rows.find(x=>x.headSha===sha)?.databaseId||'');}catch{}}
      if(!runId)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2000);
    }
    if(runId)run('gh',['run','watch',runId,'--exit-status']);else console.log('GitHub Pages run was triggered; use GitHub Actions to follow it.');
  }else console.log('GitHub Pages was triggered by the push. Install/authenticate gh CLI to have release wait for deployment automatically.');
}catch(err){
  if(!committed)fs.writeFileSync(versionPath,oldText);
  throw err;
}
