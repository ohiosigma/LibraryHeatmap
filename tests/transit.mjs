import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeTransit} from '../worker/transit.mjs';
const uint=n=>{let v=BigInt(n),b=[];if(v<0)v=BigInt.asUintN(64,v);do{let x=Number(v&127n);v>>=7n;b.push(x|(v?128:0))}while(v);return Buffer.from(b)};
const field=(id,v)=>typeof v==='number'||typeof v==='bigint'?Buffer.concat([uint(id*8),uint(v)]):Buffer.concat([uint(id*8+2),uint(v.length),v]);
const message=(...fields)=>Buffer.concat(fields),str=(id,s)=>field(id,Buffer.from(s));
const float=(id,n)=>{const b=Buffer.alloc(4);b.writeFloatLE(n);return message(uint(id*8+5),b)};
const now=Date.parse('2026-10-24T23:00:00Z')/1000;
const header=message(str(1,'2.0'),field(3,now));
const feed=e=>message(field(1,header),field(2,e));
const schedule={trips:{T:{route:'R',headsign:'Library',stops:[[1,'S',19*3600+300],[2,'S2',19*3600+600]]}}};
const trip=message(str(1,'T'),str(3,'20261024'));
const vehicle=feed(message(str(1,'V'),field(4,message(field(1,trip),field(2,message(float(1,40.915),float(2,-73.12))),field(5,now),field(8,str(1,'Bus1'))))));
let result=decodeTransit(vehicle,'positions',schedule,now);assert.equal(result.vehicles[0].routeId,'R');assert(Math.abs(result.vehicles[0].lat-40.915)<.0001);
const stop=(seq,event,relationship)=>message(field(1,seq),field(2,event),...(relationship===undefined?[]:[field(5,relationship)]));
const update=(stops,desc=trip,timestamp=now)=>feed(message(str(1,'U'),field(3,message(field(1,desc),...stops.map(s=>field(2,s)),field(4,timestamp)))));
// Negative int32 delay is encoded as a 10-byte varint. 19:05 EDT minus 2m = 23:03 UTC.
result=decodeTransit(update([stop(1,field(1,-120))]),'trips',schedule,now);assert.equal(result.arrivals[0].time,now+180);assert.equal(result.arrivals[0].stopId,'S');
result=decodeTransit(update([stop(1,field(2,now+90))]),'trips',schedule,now);assert.equal(result.arrivals[0].time,now+90);assert.equal(result.arrivals[0].basis,'prediction');
assert.equal(decodeTransit(update([stop(1,field(2,now+90),1)]),'trips',schedule,now).arrivals.length,0,'Skipped stops must be omitted');
assert.equal(decodeTransit(update([stop(1,field(2,now+90))],message(trip,field(4,3))),'trips',schedule,now).arrivals.length,0,'Cancelled trips must be omitted');
assert.equal(decodeTransit(update([stop(1,field(2,now+90))],trip,now-121),'trips',schedule,now).arrivals.length,0,'Stale predictions must be omitted');
assert.throws(()=>decodeTransit(Buffer.from([10,255]),'trips',schedule,now));
const alert=title=>field(10,field(1,str(1,title)));
result=decodeTransit(feed(message(str(1,'A'),field(5,message(alert('Detour'),field(1,message(field(1,now-100),field(2,now+100))))))),'alerts',schedule,now);assert.equal(result.alerts[0].title,'Detour');
result=decodeTransit(feed(message(str(1,'A'),field(5,message(alert('Expired'),field(1,field(2,now-1)))))),'alerts',schedule,now);assert.equal(result.alerts.length,0);
const snapshot=JSON.parse(fs.readFileSync(new URL('../public/transit-data.json',import.meta.url)));assert.equal(snapshot.routes.length,14);assert.equal(snapshot.stops.length,69);for(const t of Object.values(snapshot.trips)){assert(snapshot.routes.some(r=>r.id===t.route));assert(snapshot.shapes[t.shape]);for(const s of t.stops)assert(snapshot.stops.some(stop=>stop.id===s[1]))}
console.log('PASS: GTFS positions, signed delay ETA, exact prediction, skipped/cancelled/stale data, active alerts, malformed feed, snapshot references');
