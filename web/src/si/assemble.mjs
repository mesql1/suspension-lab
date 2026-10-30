// Reproducible packaging: deliver one standalone HTML, no runtime imports.
import {readFileSync,writeFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {fileURLToPath} from 'node:url';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const numerics=read('numerics.mjs').replaceAll('export ',''),channel=read('channel.mjs').replace(/^import .*;\r?\n/,'').replaceAll('export ','');
const physics=numerics+'\nconst C=Complex;\n'+channel;
const threeEntry=fileURLToPath(new URL('three-entry.mjs',import.meta.url));
const three=buildSync({entryPoints:[threeEntry],bundle:true,write:false,format:'iife',globalName:'THREE',minify:true,target:'es2020'}).outputFiles[0].text.replace(/[ \t]+$/gm,'');
const html=read('page.html').replace('__THREE__',()=>three).replace('__PHYSICS__',()=>physics);
writeFileSync(new URL('../../index.html',import.meta.url),html);
