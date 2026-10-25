(() => {
  let current = null, counts = [], connected = false, autoEnabled = false, autoBusy = false;
  const AUTO_KEY = 'ss-auto-location-v1';
  const LOCAL_KEY = 'ss-local-presence-v1';
  const status = document.querySelector('#sharingStatus');
  const stop = document.querySelector('#stopPresence');
  try { autoEnabled = localStorage.getItem(AUTO_KEY) === '1'; } catch {}

  function localPresenceRows() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (!saved || saved.expires <= Date.now()) { localStorage.removeItem(LOCAL_KEY); return []; }
      return [{building:saved.building,area:saved.area || '',mode:saved.mode || 'manual',count:1}];
    } catch { return []; }
  }
  function saveLocalPresence(value) {
    try {
      if (!value) localStorage.removeItem(LOCAL_KEY);
      else localStorage.setItem(LOCAL_KEY, JSON.stringify({...value,expires:Date.now()+(value.mode==='automatic'?1800000:180000)}));
    } catch {}
  }

  async function send(path, body, method = 'POST') {
    if (window.simEnabled && method !== 'DELETE') throw Error('Simulation is read-only');
    const response = await fetch('/api/' + path, {
      method,
      headers: {'Content-Type':'application/json'},
      body: body ? JSON.stringify(body) : undefined,
      keepalive: method === 'DELETE'
    });
    if (!response.ok) throw Error('Server unavailable');
    return response.json();
  }

  async function sync() {
    try {
      const response = await fetch('/api/state', {cache:'no-store'});
      if (!response.ok) throw Error('Server unavailable');
      const data = await response.json();
      connected = true;
      counts = Array.isArray(data.presence) ? data.presence : [];
      window.studyCampus?.shared(data);
      showCounts();
    } catch {
      connected = false;
      counts = localPresenceRows();
      window.studyCampus?.setPresence(counts);
      showCounts();
      if (current && status) status.textContent = 'Connection lost. Your activity signal will expire unless updates resume.';
    }
  }

  function showCounts() {
    const building = window.studyCampus?.selected();
    if (!building) return;
    document.querySelector('#presenceCount')?.remove();
    const rows = counts.filter(item => item.building === building.id);
    const total = rows.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const automatic = rows.filter(item => item.mode === 'automatic')
      .reduce((sum, item) => sum + Number(item.count || 0), 0);
    const message = window.simEnabled
      ? window.simBuildingCount(building) + ' simulated check-ins · Sample activity, not live users.'
      : !connected
        ? 'Presence service unavailable'
        : automatic
          ? automatic + ' opted-in location session' + (automatic === 1 ? '' : 's') + ' pinged this building in the last 30 minutes · Not a headcount.'
          : total
            ? total + ' recent participating app session' + (total === 1 ? '' : 's') + ' here · Location pings are not a headcount.'
            : 'No recent participating app sessions. Check-ins expire automatically.';
    const paragraph = document.createElement('p');
    paragraph.id = 'presenceCount';
    paragraph.className = 'unknown-note';
    paragraph.textContent = message;
    document.querySelector('#buildingPanel h2')?.after(paragraph);
  }

  async function heartbeat() {
    if (!current || current.mode === 'automatic' || document.visibilityState !== 'visible') return;
    try {
      await send('presence', current);
      status.textContent = 'Checked in · ' + current.name + ' · Refreshes while this page is visible';
      stop.hidden = false;
      saveLocalPresence(null);
      await sync();
    } catch {
      status.textContent = 'Check-in could not sync. Retrying while the app is visible.';
      stop.hidden = false;
      saveLocalPresence(current);
      counts = localPresenceRows();
      window.studyCampus?.setPresence(counts);
      showCounts();
    }
  }

  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > lat) !== (b[1] > lat) && lng < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function insideGeometry(lng, lat, geometry) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.some(rings => pointInRing(lng, lat, rings[0]) && !rings.slice(1).some(ring => pointInRing(lng, lat, ring)));
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!window.isSecureContext) {
        return reject(new Error('Location requires a secure page. Open the app on localhost or its HTTPS address.'));
      }
      if (!navigator.geolocation) return reject(new Error('This browser does not provide location. Choose a building manually.'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 60000
      });
    });
  }

  function explainLocationError(error) {
    if (error?.code === 1) return 'Location permission is blocked. Allow location for this site in browser settings, reload, and try again. You can choose a building without location.';
    if (error?.code === 2) return 'Your device could not determine a location. Turn on device location services and try again, or choose a building manually.';
    if (error?.code === 3) return 'Location took too long. Keep the app open, check device location services, and retry; choosing a building works too.';
    return error?.message || 'Location is unavailable. You can choose a building manually.';
  }

  async function automaticPing() {
    if (!autoEnabled || autoBusy || document.visibilityState !== 'visible') return;
    autoBusy = true;
    try {
      status.textContent = 'Checking your location for a campus building…';
      const position = await getCurrentPosition();
      const accuracy = Number(position.coords.accuracy);
      if (Number.isFinite(accuracy) && accuracy > 100) {
        status.textContent = 'Location is too imprecise to match a building. No activity signal was sent.';
        return;
      }
      const buildings = window.studyCampus?.buildings() || [];
      const building = buildings.find(item => insideGeometry(position.coords.longitude, position.coords.latitude, item.feature.geometry));
      if (!building) {
        if (current?.mode === 'automatic') {
          current = null;
          await send('presence', null, 'DELETE');
          await sync();
        }
        status.textContent = 'No campus building detected. No location was sent; checking again in 15 minutes.';
        stop.hidden = false;
        return;
      }
      current = {building:building.id, area:'', mode:'automatic', name:building.name};
      await send('presence', current);
      status.textContent = 'Automatic campus activity updated · ' + building.name + ' · Next check in 15 minutes';
      stop.hidden = false;
      await sync();
    } catch (error) {
      if (error && error.code === 1) {
        autoEnabled = false;
        try { localStorage.removeItem(AUTO_KEY); } catch {}
        status.textContent = explainLocationError(error) + ' Automatic updates stopped.';
        stop.hidden = !current;
      } else {
        status.textContent = 'Location update failed. The app will retry while it is visible.';
        stop.hidden = false;
      }
    } finally {
      autoBusy = false;
    }
  }

  window.enableAutomaticPresence = async () => {
    if (window.simEnabled) return toast('Exit sample activity before enabling live location updates.');
    autoEnabled = true;
    try { localStorage.setItem(AUTO_KEY, '1'); } catch {}
    stop.hidden = false;
    await automaticPing();
  };
  window.isAutomaticPresenceEnabled = () => autoEnabled;

  function picker(suggested = null, mode = 'manual', message = '') {
    if (window.simEnabled) return toast('Exit sample activity to check in with live data.');
    const buildings = window.studyCampus?.buildings() || [];
    if (!buildings.length) return toast('The building map is still loading. Try again in a moment.');
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<div class="modal-head"><h2>Where are you studying?</h2><button class="icon" aria-label="Close">×</button></div><p id="locationExplanation"></p><label class="field-label">Building<select id="presenceBuilding"></select></label><label class="field-label">Floor or area<select id="presenceArea"></select></label><p>Check-in is optional. Exact coordinates are not uploaded. Only the building and area you confirm are shared as aggregate activity.</p><button class="primary" id="confirmPresence">Check in here</button>';
    document.body.append(dialog);
    dialog.querySelector('#locationExplanation').textContent = message || 'Select your building and area. Manual check-ins are self-reported.';
    const buildingSelect = dialog.querySelector('#presenceBuilding');
    const areaSelect = dialog.querySelector('#presenceArea');
    for (const building of buildings) {
      const option = document.createElement('option');
      option.value = building.id;
      option.textContent = building.name;
      buildingSelect.append(option);
    }
    if (suggested) buildingSelect.value = suggested.id;
    function fillAreas() {
      const building = buildings.find(item => item.id === buildingSelect.value);
      areaSelect.replaceChildren();
      for (const area of [{id:'',name:'Building only · area unspecified'}, ...window.studyCampus.areas(building)]) {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelect.append(option);
      }
    }
    buildingSelect.onchange = fillAreas;
    fillAreas();
    dialog.querySelector('.icon').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('#confirmPresence').onclick = async () => {
      const building = buildings.find(item => item.id === buildingSelect.value);
      autoEnabled = false;
      try { localStorage.removeItem(AUTO_KEY); } catch {}
      current = {building:building.id, area:areaSelect.value, mode, name:building.name};
      dialog.close();
      window.studyCampus.select(building);
      await heartbeat();
    };
    dialog.showModal();
  }

  document.querySelector('#manualCheckin').onclick = () => picker();
  document.querySelector('#locateMe').onclick = () => {
    if (window.simEnabled) return toast('Exit sample activity to use live location check-in.');
    status.textContent = 'Finding your position…';
    getCurrentPosition().then(position => {
      const accuracy = Number(position.coords.accuracy);
      const buildings = window.studyCampus?.buildings() || [];
      const building = accuracy <= 100
        ? buildings.find(item => insideGeometry(position.coords.longitude, position.coords.latitude, item.feature.geometry))
        : null;
      status.textContent = 'Confirm your building to start sharing.';
      picker(building, building ? 'location' : 'manual', building
        ? 'Your device suggests ' + building.name + ' (about ' + Math.round(accuracy) + ' m accuracy). Confirm it; your floor cannot be inferred.'
        : 'Location accuracy is about ' + Math.round(accuracy) + ' m. We could not confidently identify a building. Please select it manually.');
    }).catch(error => {
      const explanation = explainLocationError(error);
      status.textContent = explanation;
      picker(null, 'manual', explanation);
    });
  };

  stop.onclick = async () => {
    autoEnabled = false;
    try { localStorage.removeItem(AUTO_KEY); } catch {}
    saveLocalPresence(null);
    current = null;
    stop.hidden = true;
    counts = [];
    window.studyCampus?.setPresence(counts);
    try {
      await send('presence', null, 'DELETE');
      status.textContent = 'Sharing stopped. Your check-in and automatic activity signal were removed.';
      await sync();
    } catch {
      status.textContent = 'Stopped sending updates. The last location signal will expire within 30 minutes.';
    }
  };

  window.publishCampusReport = async (building, area, value) => {
    try {
      await send('report', {building,area,status:value});
      toast('Report shared across devices.');
      await sync();
      return true;
    } catch {
      toast('Report could not sync. Please retry when connected.');
      return false;
    }
  };
  window.publishLibraryReport = async (area, report) => {
    const building = window.studyCampus?.buildings().find(item => item.library);
    if (!building) { toast('Building data is still loading. Please retry.'); return false; }
    try {
      await send('report', {building:building.id,area,status:report.status,noise:report.noise});
      toast('Report shared across devices.');
      await sync();
      return true;
    } catch {
      toast('Report could not sync. Please retry when connected.');
      return false;
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (autoEnabled) automaticPing();
    else heartbeat();
    sync();
  });
  setInterval(heartbeat, 60 * 1000);
  setInterval(() => { if (autoEnabled) automaticPing(); }, 15 * 60 * 1000);
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 15 * 1000);
  setInterval(showCounts, 2000);
  setTimeout(sync, 2000);
  window.addEventListener('pagehide', () => {
    if (current) fetch('/api/presence', {method:'DELETE',keepalive:true}).catch(() => {});
  });

  if (autoEnabled && navigator.permissions?.query) {
    navigator.permissions.query({name:'geolocation'}).then(permission => {
      if (permission.state === 'granted') automaticPing();
      else {
        status.textContent = 'Automatic updates are saved, but location is paused. Open Check in to resume.';
        stop.hidden = false;
      }
    }).catch(() => {});
  }
})();
