/* Shared study preferences survive navigation and reloads. Unknown amenities do not match. */
(()=>{
 const keys=['quiet','group','outlets'];let stored=[];try{stored=JSON.parse(localStorage.getItem('ss-study-preferences')||'[]')}catch{}
 const selected=new Set(Array.isArray(stored)?stored.filter(key=>keys.includes(key)):[]);
 const api={keys,values:()=>[...selected],has:key=>selected.has(key),matches:space=>[...selected].every(key=>space[key]===true),set(key,on){if(!keys.includes(key))return;if(on)selected.add(key);else selected.delete(key);try{localStorage.setItem('ss-study-preferences',JSON.stringify([...selected]))}catch{}window.dispatchEvent(new CustomEvent('study-preferences-change'));},clear(){for(const key of [...selected])selected.delete(key);try{localStorage.setItem('ss-study-preferences','[]')}catch{}window.dispatchEvent(new CustomEvent('study-preferences-change'));}};
 window.StudyPreferences=api;
 document.addEventListener('click',e=>{const button=e.target.closest('[data-study-pref]');if(button)api.set(button.dataset.studyPref,!api.has(button.dataset.studyPref));if(e.target.closest('[data-clear-study-prefs]'))api.clear()});
})();
