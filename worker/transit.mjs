// GTFS-Realtime wire fields: https://github.com/google/transit/blob/master/gtfs-realtime/proto/gtfs-realtime.proto
// Deliberately decode only fields used by the UI; preserve int64 precision until conversion.
function pbFields(bytes){
 let i=0;const out=new Map();
 const uint=()=>{let n=0n;for(let shift=0n;shift<70n;shift+=7n){if(i>=bytes.length)throw Error('Truncated protobuf');const b=bytes[i++];n|=BigInt(b&127)<<shift;if(!(b&128))return n}throw Error('Invalid varint')};
 while(i<bytes.length){const tag=Number(uint()),field=tag>>>3,wire=tag&7;let value;if(!field)throw Error('Invalid field');
  if(wire===0)value=uint();
  else if(wire===2){const size=Number(uint());if(!Number.isSafeInteger(size)||i+size>bytes.length)throw Error('Truncated message');value=bytes.subarray(i,i+size);i+=size}
  else if(wire===5){if(i+4>bytes.length)throw Error('Truncated float');value=new DataView(bytes.buffer,bytes.byteOffset+i,4).getFloat32(0,true);i+=4}
  else if(wire===1){if(i+8>bytes.length)throw Error('Truncated double');i+=8;continue}
  else throw Error('Unsupported wire type');
  if(!out.has(field))out.set(field,[]);out.get(field).push(value);
 }return out;
}
const pbAll=(m,f)=>m.get(f)||[],pbOne=(m,f)=>pbAll(m,f)[0],pbNum=(m,f)=>{const v=pbOne(m,f);return v===undefined?null:Number(v)},pbText=(m,f)=>{const v=pbOne(m,f);return v instanceof Uint8Array?new TextDecoder().decode(v).slice(0,2000):''},pbMsg=(m,f)=>pbFields(pbOne(m,f)||new Uint8Array());
function pbTranslation(m,f){const translations=pbAll(pbMsg(m,f),1).map(pbFields);return pbText(translations.find(t=>pbText(t,2)==='en')||translations[0]||new Map(),1)}
function transitDayStart(epoch,date){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(epoch*1000)).map(p=>[p.type,p.value]));
 const day=/^\d{8}$/.test(date)?`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`:`${parts.year}-${parts.month}-${parts.day}`;
 const noon=Date.parse(day+'T12:00:00Z');const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(new Date(noon)).find(p=>p.type==='timeZoneName').value;
 const offset=zone.match(/GMT([+-])(\d+)(?::(\d+))?/);const seconds=offset?(offset[1]==='-'?-1:1)*(Number(offset[2])*3600+Number(offset[3]||0)*60):0;
 return noon/1000-seconds-43200;
}
export function decodeTransit(bytes,kind,schedule,now=Date.now()/1000){
 const feed=pbFields(bytes),header=pbMsg(feed,1),timestamp=pbNum(header,3);if(!pbText(header,1))throw Error('Missing GTFS header');
 const result={timestamp,vehicles:[],arrivals:[],alerts:[]};
 for(const raw of pbAll(feed,2)){
  const entity=pbFields(raw);if(pbNum(entity,2)===1)continue;
  if(kind==='positions'&&pbOne(entity,4)){
   const v=pbMsg(entity,4),p=pbMsg(v,2),t=pbMsg(v,1),d=pbMsg(v,8),tripId=pbText(t,1),lat=pbNum(p,1),lon=pbNum(p,2);
   if(lat===null||lon===null||lat<40.65||lat>41.3||lon< -73.6||lon> -72.2)continue;
   result.vehicles.push({id:pbText(d,1)||pbText(entity,1),label:pbText(d,2)||'SBU bus',tripId,routeId:pbText(t,5)||schedule.trips[tripId]?.route||'',lat,lon,bearing:pbNum(p,3),stopId:pbText(v,7),timestamp:pbNum(v,5)||timestamp});
  }
  if(kind==='trips'&&pbOne(entity,3)){
   const u=pbMsg(entity,3),t=pbMsg(u,1),tripId=pbText(t,1),trip=schedule.trips[tripId],relationship=pbNum(t,4);if([3,7].includes(relationship))continue;
   const updated=pbNum(u,4)||timestamp;if(!updated||now-updated>120||updated-now>60)continue;
   for(const rawStop of pbAll(u,2)){
    const stop=pbFields(rawStop);if([1,2].includes(pbNum(stop,5)))continue;
    const sequence=pbNum(stop,1),entry=trip?.stops.find(s=>s[0]===sequence||sequence===null&&s[1]===pbText(stop,4));const stopId=pbText(stop,4)||entry?.[1];
    const event=pbOne(stop,2)?pbMsg(stop,2):pbMsg(stop,3);let arrival=pbNum(event,2),basis='prediction';
    if(arrival===null&&pbOne(event,1)!==undefined&&entry?.[2]!==null&&entry?.[2]!==undefined){const delay=Number(BigInt.asIntN(32,pbOne(event,1)));arrival=transitDayStart(updated,pbText(t,3))+entry[2]+delay;basis='schedule + live delay'}
    if(stopId&&arrival!==null&&arrival>=now-30&&arrival<=now+7200)result.arrivals.push({tripId,routeId:pbText(t,5)||trip?.route||'',stopId,time:arrival,headsign:trip?.headsign||'',basis,timestamp:updated});
   }
  }
  if(kind==='alerts'&&pbOne(entity,5)){
   const a=pbMsg(entity,5),periods=pbAll(a,1).map(pbFields);if(periods.length&&!periods.some(p=>(pbNum(p,1)??0)<=now&&(pbNum(p,2)??Infinity)>=now))continue;
   const title=pbTranslation(a,10),description=pbTranslation(a,11);if(title||description)result.alerts.push({title,description,routes:pbAll(a,5).map(pbFields).map(m=>pbText(m,2)).filter(Boolean)});
  }
 }return result;
}
let transitMemo=null,transitInFlight=null;
export async function transitResponse(schedule){
 const now=Date.now();if(transitMemo&&now-transitMemo.fetchedAt<15000)return Response.json(transitMemo,{headers:{'Cache-Control':'no-store'}});
 if(!transitInFlight)transitInFlight=(async()=>{
  const specs=[['positions','position_updates.pb'],['trips','trip_updates.pb'],['alerts','alerts.pb']];
  const results=await Promise.allSettled(specs.map(async([kind,file])=>{const r=await fetch('https://s3.amazonaws.com/etatransit.gtfs/stonybrook.etaspot.net/'+file,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Upstream unavailable');const b=new Uint8Array(await r.arrayBuffer());if(b.length>2000000)throw Error('Feed too large');return decodeTransit(b,kind,schedule)}));
  const payload={fetchedAt:Date.now(),sources:{},vehicles:[],arrivals:[],alerts:[]};
  results.forEach((r,i)=>{const kind=specs[i][0];payload.sources[kind]={ok:r.status==='fulfilled',timestamp:r.status==='fulfilled'?r.value.timestamp:null};if(r.status==='fulfilled'){payload.vehicles.push(...r.value.vehicles);payload.arrivals.push(...r.value.arrivals);payload.alerts.push(...r.value.alerts)}});
  transitMemo=payload;return payload;
 })().finally(()=>{transitInFlight=null});
 const payload=await transitInFlight;return Response.json(payload,{status:Object.values(payload.sources).some(s=>s.ok)?200:503,headers:{'Cache-Control':'no-store'}});
}
