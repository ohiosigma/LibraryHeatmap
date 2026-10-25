/* Present area-level evidence without claiming a measured building occupancy. */
(()=>{
 window.summarizeFavorite=(snapshot,now=Date.now())=>{
  const areas=snapshot.areas||[],valid=areas.filter(a=>a.state&&a.state.status!=='unknown'&&Number.isFinite(a.state.stamp)&&now-a.state.stamp>=0&&now-a.state.stamp<1800000),open=valid.filter(a=>a.state.status==='open'),latest=valid.length?Math.max(...valid.map(a=>a.state.stamp)):null;
  const amenities=[];for(const [key,label] of [['quiet','Quiet study'],['group','Group seating'],['outlets','Outlets']]){const matching=areas.filter(a=>a[key]===true).length;if(matching)amenities.push(`${label} · ${matching} area${matching===1?'':'s'}`)}
  const sorted=[...areas].sort((a,b)=>(a.state?.status==='open'?0:1)-(b.state?.status==='open'?0:1));
  return {headline:open.length?`${open.length} area${open.length===1?'':'s'} reported open`:valid.length?'Recent reports available':'Seats unconfirmed',coverage:`${valid.length} of ${areas.length} areas recently reported`,freshness:latest===null?'No recent seat reports':`Latest report ${Math.floor((now-latest)/60000)<1?'just now':Math.floor((now-latest)/60000)+' min ago'}`,checkins:snapshot.connected?`${snapshot.checkins||0} recent app session${snapshot.checkins===1?'':'s'}`:snapshot.checkins?`${snapshot.checkins} local check-in${snapshot.checkins===1?'':'s'}`:'Live check-ins unavailable',amenities,areas:sorted.slice(0,3).map(a=>{const fresh=valid.includes(a);return {name:a.name,status:!fresh?'unknown':a.state.status,label:!fresh?'Unconfirmed':a.state.status==='open'?'Seats available':a.state.status==='filling'?'A few seats':'Reported full'}}),sample:!!snapshot.sample};
 };
})();
