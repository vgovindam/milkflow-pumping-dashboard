import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const r=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:ROOT,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
  let file=path.join(DIST,rel);
  if(!file.startsWith(DIST)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(DIST,'index.html');
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`MilkFlow dev server: http://127.0.0.1:${port}`));
