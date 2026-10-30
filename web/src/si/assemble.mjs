// Reproducible packaging: deliver one standalone HTML, no runtime imports.
import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const numerics=read('numerics.mjs').replaceAll('export ',''),channel=read('channel.mjs').replace(/^import .*;\r?\n/,'').replaceAll('export ','');
const physics=numerics+'\nconst C=Complex;\n'+channel;
const html=read('page.html').replace('__PHYSICS__',()=>physics);
writeFileSync(new URL('../../index.html',import.meta.url),html);
