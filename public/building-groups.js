(() => {
  const panel = document.querySelector('#buildingPanel');
  if (!panel) return;
  const STORE = 'campus-circle-groups-v1';
  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const readLocal = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  };
  const dateLabel = group => {
    const day = group.date ? new Date(group.date + 'T12:00:00') : new Date();
    return day.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
  };
  const mount = async () => {
    const link = panel.querySelector('.study-group-action');
    if (!link || panel.querySelector('.building-groups')) return;
    const building = link.textContent ? panel.querySelector('h2')?.textContent.trim() : '';
    if (!building) return;
    const section = document.createElement('section');
    section.className = 'building-groups';
    section.innerHTML = '<div class="building-groups-head"><div><strong>Study groups here</strong><small class="group-sync">Loading groups…</small></div><button type="button" class="group-create-toggle">＋ Create group</button></div><div class="building-group-list" aria-live="polite"></div><details class="building-group-form-wrap"><summary>Plan a study session at this building</summary><form class="building-group-form"><label>Study topic<input name="topic" required maxlength="70" placeholder="e.g. Cell structure and mitosis"></label><div class="building-group-fields"><label>Class / course<input name="course" required maxlength="50" placeholder="e.g. BIO 201"></label><label>Test or assignment<input name="test" maxlength="60" placeholder="Optional"></label><label>Group size<select name="size"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option>8</option><option>10</option><option>12</option></select></label><label>Date<input name="date" type="date" required></label><label>Start time<input name="time" type="time" value="16:00" required></label><label>Your name<input name="host" maxlength="30" placeholder="Optional"></label></div><label>Contact (optional)<input name="contact" maxlength="60" placeholder="Email or campus handle"></label><button class="primary" type="submit">Post study group</button><p class="group-form-status" role="status"></p></form></details><a class="group-board-link" href="study-groups.html?location=' + encodeURIComponent(building) + '">Open the full study group board ↗</a></section>';
    link.replaceWith(section);
    const list = section.querySelector('.building-group-list');
    const sync = section.querySelector('.group-sync');
    const localGroups = () => readLocal().filter(group => group.location && group.location.toLowerCase() === building.toLowerCase());
    const renderGroups = groups => {
      const today = new Date(); today.setHours(0,0,0,0);
      const upcoming = groups.filter(group => {
        const date = group.date ? new Date(group.date + 'T12:00:00') : new Date();
        return date >= today;
      }).sort((a,b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
      if (!upcoming.length) {
        list.innerHTML = '<div class="building-group-empty">No upcoming study groups here yet. Start one and invite classmates.</div>';
        return;
      }
      list.innerHTML = upcoming.slice(0, 4).map(group => {
        const seats = Math.max(0, Number(group.size || 4) - 1 - Number(group.joined || 0));
        return '<article class="building-group-card"><div class="building-group-card-top"><strong>' + escapeHTML(group.topic) + '</strong><span>' + seats + ' open</span></div><div class="building-group-course">' + escapeHTML(group.course || 'Course not listed') + (group.test ? ' · ' + escapeHTML(group.test) : '') + '</div><div class="building-group-when">' + escapeHTML(dateLabel(group)) + ' · ' + escapeHTML(group.time || 'Time not set') + ' · Hosted by ' + escapeHTML(group.host || 'Student') + '</div></article>';
      }).join('');
    };
    const loadGroups = async () => {
      try {
        const response = await fetch('/api/study-groups?location=' + encodeURIComponent(building), {cache:'no-store'});
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        const remote = Array.isArray(data.groups) ? data.groups : [];
        const ids = new Set(remote.map(group => group.id));
        renderGroups(remote.concat(localGroups().filter(group => !ids.has(group.id))));
        sync.textContent = 'Shared with students';
        sync.classList.add('connected');
      } catch {
        renderGroups(localGroups());
        sync.textContent = 'Saved in this browser';
        sync.classList.remove('connected');
      }
    };
    const formWrap = section.querySelector('.building-group-form-wrap');
    const form = section.querySelector('.building-group-form');
    const toggle = section.querySelector('.group-create-toggle');
    toggle.addEventListener('click', () => { formWrap.open = !formWrap.open; if (formWrap.open) form.elements.topic.focus(); });
    const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    form.elements.date.min = today.toISOString().slice(0,10);
    form.elements.date.value = form.elements.date.min;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const group = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        topic: String(data.get('topic')).trim(),
        course: String(data.get('course')).trim(),
        test: String(data.get('test')).trim(),
        location: building,
        size: Number(data.get('size')),
        date: String(data.get('date')),
        time: String(data.get('time')),
        host: String(data.get('host')).trim() || 'Student',
        contact: String(data.get('contact')).trim(),
        joined: 0,
        created: Date.now()
      };
      const status = form.querySelector('.group-form-status');
      try {
        const response = await fetch('/api/study-groups', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(group)});
        if (!response.ok) throw new Error('Shared posting unavailable');
        status.textContent = 'Group posted and visible to students.';
      } catch {
        const groups = readLocal();
        groups.unshift(group);
        try { localStorage.setItem(STORE, JSON.stringify(groups)); }
        catch { status.textContent = 'Could not save this group in the browser.'; return; }
        status.textContent = 'Saved on this device. Shared posting is unavailable.';
      }
      await loadGroups();
      form.reset();
      form.elements.date.min = today.toISOString().slice(0,10);
      form.elements.date.value = form.elements.date.min;
      form.elements.time.value = '16:00';
    });
    loadGroups();
  };
  new MutationObserver(mount).observe(panel, {childList:true});
  mount();
})();