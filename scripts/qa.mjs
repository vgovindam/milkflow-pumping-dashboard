import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist'),ROOT_AUDIT=path.join(ROOT,'visual-audit'),DIST_AUDIT=path.join(DIST,'visual-audit');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function runNode(file,{cwd=ROOT}={}){return spawnSync(process.execPath,[file],{cwd,stdio:'inherit',encoding:'utf8'}).status??1;}
if(runNode('scripts/build.mjs')!==0)process.exit(1);
let ok=false;
for(let attempt=1;attempt<=3&&!ok;attempt++){
  console.log(`Browser visual QA attempt ${attempt}/3`);
  ok=runNode(path.join(ROOT,'scripts/browser-qa.mjs'),{cwd:DIST})===0;
  if(!ok&&attempt<3)await sleep(1200);
}
if(!ok)throw new Error('Browser visual QA failed after 3 attempts.');
fs.rmSync(ROOT_AUDIT,{recursive:true,force:true});
if(fs.existsSync(DIST_AUDIT))fs.cpSync(DIST_AUDIT,ROOT_AUDIT,{recursive:true});
fs.rmSync(DIST_AUDIT,{recursive:true,force:true});
console.log('Visual QA passed against the exact dist/ production build.');
