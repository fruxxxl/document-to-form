import {createWorker, PSM} from 'tesseract.js';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {extractFields, fieldKeys} from '../src/extract';
const expected = JSON.parse(await readFile('public/examples/expected.json','utf8'));
await mkdir('.ocr-cache', {recursive:true});
const worker = await createWorker(['rus','eng'],1,{langPath:resolve('public/ocr'),cachePath:resolve('.ocr-cache')});
const results=[];
try {
  await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,user_defined_dpi:'300'});
  for (const name of Object.keys(expected)) {
    const start=Date.now();
    const {data}=await worker.recognize(`public/examples/${name}.png`);
    const fields=extractFields(data.text);
    const normalize=(s:string)=>s.replace(/[«»“”„"]/g,'').replace(/\s+/g,' ').trim();
    const matches=Object.fromEntries(fieldKeys.map(k=>[k, normalize(fields[k].value)===normalize(expected[name][k])]));
    results.push({sample:name,ms:Date.now()-start,text:data.text,fields,matches});
  }
} finally {await worker.terminate();}
await mkdir('docs',{recursive:true});
await writeFile('docs/ocr-results.json',JSON.stringify({engine:'Tesseract.js 7.0.0',scope:'Three synthetic samples; not a real-document accuracy estimate',results},null,2)+'\n');
for(const r of results) console.log(r.sample, r.matches, r.ms+' ms');
if (!Object.values(results[0].matches).every(Boolean)) throw new Error('Clean fixture did not match expected fields');
if (!results[2].fields.inn.issue || results[2].fields.kpp.value) throw new Error('Invalid/missing fields were accepted');
