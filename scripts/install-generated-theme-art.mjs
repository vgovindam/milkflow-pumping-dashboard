/* Install the family's generated portrait artwork as responsive scene plates.
 * Usage: node scripts/install-generated-theme-art.mjs ../generated-art
 * The source-art WebP files remain in the repo for later re-renders.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(input))throw new Error('Pass the directory containing the generated PNGs');
const assignments={
  safari:['image-gen-1(1).png','image-gen-2(1).png','image-gen-3(1).png','image-gen-4(1).png'],
  butterfly:['image-gen-1(2).png','image-gen-2(2).png','image-gen-3(2).png','image-gen-4(2).png'],
  princess:['image-gen-5(1).png','image-gen-6(1).png','image-gen-7(1).png','image-gen-8.png'],
  'cozy-clouds':['image-gen-1(3).png','image-gen-2(3).png','image-gen-3(3).png','image-gen-4(3).png'],
  celestial:['image-gen-1(4).png','image-gen-2(4).png','image-gen-3(4).png','image-gen-4(4).png'],
  ocean:['image-gen-1(5).png','image-gen-2(5).png','image-gen-3(5).png','image-gen-4(5).png'],
  'safari-sunset':['image-gen-1(6).png','image-gen-2(6).png','image-gen-3(6).png','image-gen-4(6).png']
};
function convert(args){const result=spawnSync('convert',args,{stdio:'inherit'});if(result.status!==0||!fs.existsSync(args.at(-1))||fs.statSync(args.at(-1)).size<4000)throw new Error(`ImageMagick conversion failed: ${args.at(-1)}`);}
for(const [theme,images] of Object.entries(assignments)){
  for(let i=0;i<images.length;i++){
    const mode=i%2?'dark':'light';
    const realm=i<2?'baby':'mom';
    const dir=path.join(root,'assets/themes-v2',theme,mode);
    fs.mkdirSync(dir,{recursive:true});
    const source=path.join(dir,`${realm}-source-art.webp`);
    convert([path.join(input,images[i]),'-strip','-quality','86',source]);
    // Keep the portrait intact for the page and preview. A short crop puts the
    // world's illustrated frame around the hero while leaving its centre readable.
    for(const width of [640]){
      const height=Math.round(width*0.72);
      convert([source,'-resize',`${width}x${height}^`,'-gravity','north','-extent',`${width}x${height}`,'-strip','-quality','82',path.join(dir,`${realm}-generated-hero@${width}.webp`)]);
    }
  }
  console.log(`Installed generated scenes: ${theme}`);
}
