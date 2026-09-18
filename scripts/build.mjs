import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const versionDoc=JSON.parse(fs.readFileSync(path.join(ROOT,'version.json'),'utf8'));
const VERSION=String(versionDoc.version||'').trim();
if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(VERSION))throw new Error(`Invalid version.json version: ${VERSION}`);
let COMMIT=process.env.GITHUB_SHA||'';
if(!COMMIT){try{COMMIT=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}catch{COMMIT='local';}}

const TEXT_FILES=[
  'index.html','styles.css','theme.css','component-theme.css','component-theme-core.css','experience-themes.css','experience-system.css','experience-components.css','doctor-summary.css',
  'config.js','app.js','cross-device-alerts.js','app-reliability.js','core-ui.js','experience-theme.js','render-lifecycle.js','plan-reliability.js','network-reliability.js','ai-coach-client.js','app-update-notice.js','family-chat.js','doctor-summary.js','release-info.js','manifest.webmanifest','icon.svg'
];
const BINARY_FILES=['milkflow-family-v3-192.png'];

function ensureDir(file){fs.mkdirSync(path.dirname(file),{recursive:true});}
function transform(text){
  return text
    .replaceAll('__MILKFLOW_VERSION__',VERSION)
    .replaceAll('__MILKFLOW_COMMIT__',COMMIT)
    .replace(/\?build=stable45-human\d+/g,`?v=${VERSION}`)
    .replace(/stable45-human\d+/g,`v${VERSION}`)
    .replace(/safari-world-v2\.svg/g,'safari-world.svg');
}
function copyText(rel){
  const src=path.join(ROOT,rel),dest=path.join(DIST,rel);
  if(!fs.existsSync(src))throw new Error(`Missing production source: ${rel}`);
  ensureDir(dest);fs.writeFileSync(dest,transform(fs.readFileSync(src,'utf8')));
}
function copyBinary(rel){
  const src=path.join(ROOT,rel);if(!fs.existsSync(src))throw new Error(`Missing production binary: ${rel}`);
  const dest=path.join(DIST,rel);ensureDir(dest);fs.copyFileSync(src,dest);
}
function copyTree(srcDir,destDir){
  if(!fs.existsSync(srcDir))return;
  for(const entry of fs.readdirSync(srcDir,{withFileTypes:true})){
    if(entry.name==='.DS_Store'||entry.name==='safari-world-v2.svg')continue;
    const src=path.join(srcDir,entry.name),dest=path.join(destDir,entry.name);
    if(entry.isDirectory())copyTree(src,dest);
    else{ensureDir(dest);fs.copyFileSync(src,dest);}
  }
}
function listFiles(dir,base=dir){
  if(!fs.existsSync(dir))return[];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...listFiles(full,base));
    else out.push(path.relative(base,full).split(path.sep).join('/'));
  }
  return out.sort();
}
function localPath(ref){
  const clean=ref.split('#')[0].split('?')[0];
  if(!clean||/^(?:https?:|data:|blob:|mailto:)/.test(clean))return null;
  return clean.replace(/^\.\//,'').replace(/^\//,'');
}
function verifyIndexRefs(){
  const html=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
    const rel=localPath(m[1]);if(!rel)continue;
    if(!fs.existsSync(path.join(DIST,rel)))throw new Error(`index.html references missing asset: ${m[1]}`);
  }
  for(const css of ['theme.css','component-theme.css']){
    const text=fs.readFileSync(path.join(DIST,css),'utf8');
    for(const m of text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)){
      const rel=localPath(m[1]);if(rel&&!fs.existsSync(path.join(DIST,rel)))throw new Error(`${css} imports missing asset: ${m[1]}`);
    }
  }
}

fs.rmSync(DIST,{recursive:true,force:true});fs.mkdirSync(DIST,{recursive:true});
TEXT_FILES.forEach(copyText);BINARY_FILES.forEach(copyBinary);
copyTree(path.join(ROOT,'assets'),path.join(DIST,'assets'));
for(const theme of ['safari','butterfly','princess','unicorn']){
  for(const mode of ['light','dark'])for(const role of ['baby-background','baby-hero','mom-background','mom-hero','settings-preview']){
    const scene=path.join(ROOT,`assets/themes-v2/${theme}/${mode}/${role}.svg`);
    if(!fs.existsSync(scene))throw new Error(`Missing canonical self-contained ${theme}/${mode}/${role} scene`);
  }
}
verifyIndexRefs();

/* Theme worlds are fetched and runtime-cached on demand. Shipping all 40 variants in the
   install shell would make first launch unnecessarily expensive on mobile. */
const shellFiles=listFiles(DIST).filter(f=>!f.startsWith('visual-audit/')&&!f.startsWith('assets/themes-v2/')&&!['build-manifest.json','sw.js'].includes(f));
const shell=['./',...shellFiles.map(f=>`./${f}`)];
let sw=fs.readFileSync(path.join(ROOT,'sw.template.js'),'utf8');
sw=sw.replaceAll('__MILKFLOW_VERSION__',VERSION).replace('__MILKFLOW_SHELL__',JSON.stringify(shell,null,2));
fs.writeFileSync(path.join(DIST,'sw.js'),sw);

const manifest={version:VERSION,commit:COMMIT,builtAt:new Date().toISOString(),assets:listFiles(DIST)};
fs.writeFileSync(path.join(DIST,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built MilkFlow ${VERSION} (${COMMIT.slice(0,8)}) -> dist/ with ${manifest.assets.length} files`);
