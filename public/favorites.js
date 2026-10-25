(()=>{
 const favorites=window.BuildingFavorites,panel=document.querySelector('#buildingPanel'),campus=document.querySelector('#campusView'),indoor=document.querySelector('#indoorView');
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const view=document.createElement('section');view.id='favoriteSpaces';view.hidden=true;view.setAttribute('aria-labelledby','favoriteSpacesTitle');
 view.innerHTML='<div class="spaces-heading"><span class="eyebrow">YOUR CAMPUS SHORTLIST</span><h1 id="favoriteSpacesTitle">Your spaces</h1><p>The places you love, a tap away. Heart a building to keep it here.</p></div><div id="favoriteBuildingList"></div><p class="spaces-storage">Favorites are saved in this browser. They aren’t shared with other students or synced across devices.</p>';
 document.querySelector('main').append(view);
 function heart(){const header=panel.querySelector('.building-panel-header'),building=window.studyCampus?.selected();if(!header||!building)return;
  let button=header.querySelector('.building-favorite');if(!button){button=document.createElement('button');button.type='button';button.className='building-favorite';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';header.insertBefore(button,header.querySelector('.panel-close'));button.onclick=()=>{const current=window.studyCampus?.selected();if(current)favorites.toggle(current.id)}}
  const active=favorites.has(building.id),label=(active?'Remove ':'Save ')+building.name+(active?' from Spaces':' to Spaces');
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  button.setAttribute('aria-pressed',String(active));button.title=label;
 }
 function render(){const buildings=window.studyCampus?.buildings()||[],saved=buildings.filter(b=>favorites.has(b.id)),list=view.querySelector('#favoriteBuildingList');
  if(!saved.length){list.innerHTML='<div class="spaces-empty"><span aria-hidden="true">♡</span><h2>Your next favorite is out there.</h2><p>Explore the campus map, open a building, and tap the heart beside its name.</p><button class="primary" id="exploreForFavorites">Explore campus →</button></div>';list.querySelector('#exploreForFavorites').onclick=()=>document.querySelector('.app-nav [data-tab="explore"]').click();return}
  list.innerHTML='<p class="spaces-count">'+saved.length+' favorite building'+(saved.length===1?'':'s')+'</p><div class="favorite-grid">'+saved.map(b=>{const summary=window.summarizeFavorite(window.studyCampus.favoriteSnapshot(b));return `<article class="favorite-building"><div class="favorite-summary-top"><span class="eyebrow">${summary.sample?'SAMPLE ACTIVITY':b.library?'LIBRARY':'CAMPUS BUILDING'}</span><button class="remove-favorite" data-remove-favorite="${escape(b.id)}" aria-label="Remove ${escape(b.name)} from Spaces">♥</button></div><h2>${escape(b.name)}</h2><div class="favorite-headline">${escape(summary.headline)}</div><p class="favorite-freshness">${escape(summary.freshness)}<br>${escape(summary.coverage)}</p><div class="favorite-amenities">${summary.amenities.map(text=>`<span>${escape(text)}</span>`).join('')||'<span>Study amenities not verified</span>'}</div><ul class="favorite-area-list">${summary.areas.map(area=>`<li><span>${escape(area.name)}</span><strong class="${area.status}">${escape(area.label)}</strong></li>`).join('')}</ul><p class="favorite-checkins">${escape(summary.checkins)} · not a total headcount</p><div class="favorite-actions"><button class="primary" data-open-favorite="${escape(b.id)}">Full details →</button></div></article>`}).join('')+'</div>';
  list.querySelectorAll('[data-open-favorite]').forEach(button=>button.onclick=()=>{const b=buildings.find(b=>b.id===button.dataset.openFavorite);if(!b)return;view.hidden=true;window.studyCampus.home();window.studyCampus.select(b)});
  list.querySelectorAll('[data-remove-favorite]').forEach(button=>button.onclick=()=>favorites.toggle(button.dataset.removeFavorite));
 }
 document.querySelector('[data-view="saved"]').onclick=()=>{view.hidden=false;campus.hidden=true;indoor.hidden=true;document.body.classList.add('spaces-view');document.body.classList.remove('navigating');render();window.scrollTo({top:0,behavior:'smooth'})};
 function hide(){view.hidden=true;document.body.classList.remove('spaces-view')}
 document.querySelector('.app-nav [data-tab="explore"]').addEventListener('click',hide);
 document.querySelector('.app-brand').addEventListener('click',hide);
 window.addEventListener('building-selected',hide);
 window.addEventListener('campus-activity-updated',()=>{if(!view.hidden)render()});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!view.hidden)render()});
 window.addEventListener('building-favorites-change',()=>{heart();if(!view.hidden)render()});
 new MutationObserver(heart).observe(panel,{childList:true,subtree:true});heart();
})();
