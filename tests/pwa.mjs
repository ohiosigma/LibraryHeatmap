import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.id,'/');assert.equal(new URL(manifest.start_url,'https://example.test').pathname,'/');
for(const icon of manifest.icons){const bytes=fs.readFileSync('public'+icon.src);assert.equal(bytes.toString('ascii',1,4),'PNG');assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes)}
assert(manifest.icons.some(icon=>icon.sizes==='192x192'));assert(manifest.icons.some(icon=>icon.sizes==='512x512'));assert(manifest.icons.some(icon=>icon.purpose==='maskable'));
const html=fs.readFileSync('public/index.html','utf8');assert(html.includes('rel="manifest"'));assert(html.includes('rel="apple-touch-icon"'));assert(html.includes('src="install.js"'));
const listeners={},deleted=[],added=[];let fail=false;
const offline=new Response('offline fallback');
const context={URL,Response,self:{location:{origin:'https://example.test'},clients:{async claim(){}},addEventListener:(name,fn)=>listeners[name]=fn},caches:{async open(){return{async add(url){added.push(url)}}},async keys(){return ['studysignal-offline-old','studysignal-offline-v2','another-app']},async delete(name){deleted.push(name)},async match(){return offline.clone()}},fetch:async()=>{if(fail)throw Error('offline');return new Response('network',{status:200})}};
vm.runInNewContext(fs.readFileSync('public/service-worker.js','utf8'),context);
let pending;listeners.install({waitUntil:p=>pending=p});await pending;assert.deepEqual(added,['/offline.html']);
listeners.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['studysignal-offline-old']);
for(const [pathname,method,mode] of [['/api/state','GET','navigate'],['/api/transit','GET','cors'],['/api/laundry?room=123','GET','cors'],['/api/report','POST','cors'],['/app.js','GET','cors']]){let handled=false;listeners.fetch({request:{url:'https://example.test'+pathname,method,mode},respondWith(){handled=true}});assert.equal(handled,false,'Private or live requests must not enter the cache')}
const navigation=()=>{listeners.fetch({request:{url:'https://example.test/?building=123',method:'GET',mode:'navigate'},respondWith:p=>pending=p});return pending};
assert.equal(await (await navigation()).text(),'network');fail=true;assert.equal(await (await navigation()).text(),'offline fallback');
context.fetch=async()=>new Response('Sign in required',{status:401});assert.equal((await navigation()).status,401,'Never replace a real authentication response with cached content');
console.log('PASS: install manifest, PNG dimensions, offline navigation, auth preservation, cache cleanup, and no caching of live APIs');
