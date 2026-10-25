import assert from 'node:assert/strict';
import { api } from '../worker/api.mjs';
const origin='https://studysignal.test', session='a'.repeat(64), sessions=[];
const DB={prepare(sql){return {bind(...args){if(sql.startsWith('INSERT INTO presence')||sql.startsWith('DELETE FROM presence WHERE session'))sessions.push(args[0]);return this},async run(){return {success:true}}}},async batch(){return []}};
for(const cookie of [`ss_session=${session}`,`theme=dark; ss_session=${session}; other=value`,`theme=dark;ss_session=${session}`]){
 const request=new Request(origin+'/api/presence',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({building:'1',area:'whole',mode:'manual'})});
 const result=await api(request,{DB},new Set(['1']));
 assert.equal(result.status,200);assert.equal(sessions.at(-1),session,'Heartbeat must reuse identity regardless of cookie order');
 assert.ok(result.headers.get('Set-Cookie').startsWith(`ss_session=${session};`));
 const deletion=await api(new Request(origin+'/api/presence',{method:'DELETE',headers:{Origin:origin,Cookie:cookie}}),{DB},new Set(['1']));
 assert.equal(deletion.status,200);assert.equal(sessions.at(-1),session,'Stop sharing must delete the existing identity');
}
console.log('PASS: presence heartbeat and removal preserve identity with first, later, and unspaced session cookies');
