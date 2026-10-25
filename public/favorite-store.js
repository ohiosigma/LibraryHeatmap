/* Building favorites are independent of the existing saved indoor zones. */
(()=>{
 const key='ss-favorite-buildings';let ids;
 const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return new Set(Array.isArray(value)?value.filter(id=>typeof id==='string'):[])}catch{return new Set()}};
 ids=read();const notify=()=>window.dispatchEvent(new CustomEvent('building-favorites-change'));
 window.BuildingFavorites={has:id=>ids.has(id),values:()=>[...ids],toggle(id){if(typeof id!=='string'||!id)return;ids.has(id)?ids.delete(id):ids.add(id);try{localStorage.setItem(key,JSON.stringify([...ids]))}catch{window.toast?.('Favorites will last for this visit; browser storage is unavailable.')}notify()}};
 window.addEventListener('storage',e=>{if(e.key===key||e.key===null){ids=read();notify()}});
})();
