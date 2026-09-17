import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=process.argv[2];if(!version||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw new Error('Usage: npm run rollback -- <x.y.z>');
function run(cmd,a=[],capture=false){const r=spawnSync(cmd,a,{cwd:ROOT,encoding:'utf8',stdio:capture?'pipe':'inherit'});if(r.status!==0)throw new Error(`${cmd} ${a.join(' ')} failed`);return capture?String(r.stdout||'').trim():'';}
if(run('git',['rev-parse','--abbrev-ref','HEAD'],true)!=='main')throw new Error('Rollback must run from main.');
if(run('git',['status','--porcelain'],true))throw new Error('Working tree must be clean before rollback.');
run('git',['fetch','origin','main','--tags']);
if(run('git',['rev-parse','HEAD'],true)!==run('git',['rev-parse','origin/main'],true))throw new Error('Local main must match origin/main before rollback.');
const tag=`v${version}`;run('git',['rev-parse','--verify',`${tag}^{commit}`],true);
console.log(`Restoring tracked source tree from ${tag}; Git history remains intact.`);
run('git',['read-tree','--reset','-u',tag]);
run('npm',['run','verify']);
run('git',['commit','-m',`Rollback production to ${tag}`]);
const sha=run('git',['rev-parse','HEAD'],true);run('git',['push','origin','main']);
console.log(`Rollback commit ${sha} pushed. GitHub Pages will deploy the restored ${tag} tree.`);
