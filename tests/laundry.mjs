import assert from 'node:assert/strict';
import fs from 'node:fs';
const tools=fs.readFileSync('public/student-tools.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
assert(!tools.includes('onetapaway'));
assert(!tools.includes("tab==='Laundry'"));
assert(!tools.includes('stonybrook.edu/res/services/laundry.html'));
for(const obsolete of ['laundryTimer','laundryRemaining','clearLaundry','setInterval(tick','student-tools-rendered','LaundryView machine status'])assert(!tools.includes(obsolete),obsolete+' must be removed');
assert(!html.includes('src="laundry.js"'));assert(!html.includes('href="laundry.css"'));
assert(!fs.existsSync('worker/laundry.mjs'));assert(!fs.existsSync('public/laundry.js'));
const {default:app}=await import('data:text/javascript;base64,'+fs.readFileSync('dist/server/index.js').toString('base64'));
const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('Retired laundry route must not fetch an upstream provider')};
try{for(const method of ['GET','POST']){const response=await app.fetch(new Request('https://study.test/api/laundry?room=88000536',{method}),{});assert.equal(response.status,410);const data=await response.json();assert(data.error.includes('no longer part of StudySignal'));assert.equal(data.machines,undefined)}}finally{globalThis.fetch=previous}
console.log('PASS: no laundry feature or timer, no retired tracker scripts, retired API returns 410 without upstream requests');
