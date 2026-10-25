(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const buildings = () => window.studyCampus?.buildings() || [];
  const building = id => buildings().find(item => item.id === id);
  const options = () => buildings().filter(item => !item.name.startsWith('Unnamed')).map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
  const centroid = item => {
    const points = item.feature.geometry.coordinates[0];
    return [points.reduce((sum, point) => sum + point[1], 0) / points.length, points.reduce((sum, point) => sum + point[0], 0) / points.length];
  };
  const launcher = document.createElement('button');
  launcher.id = 'studentTools';
  launcher.textContent = 'Study break';
  launcher.setAttribute('aria-label', 'Plan a study break');
  launcher.setAttribute('aria-haspopup', 'dialog');
  $('#campusView').append(launcher);
  const dialog = document.createElement('dialog');
  dialog.id = 'studentDialog';
  dialog.setAttribute('aria-labelledby', 'studyBreakTitle');
  document.body.append(dialog);
  function render() {
    dialog.innerHTML = `<div class="student-heading"><h2 id="studyBreakTitle">Plan a study break</h2><button id="closeStudent" aria-label="Close study-break planner">×</button></div><div id="studentBody"><form id="breakPlanner"><label>Time available (minutes)<input name="minutes" type="number" min="20" max="240" value="45" required></label><label>Starting building<select name="origin" required>${options()}</select></label><label>Finish near<select name="destination"><option value="">Return to starting building</option>${options()}</select></label><button class="primary" type="submit">Find a study space</button></form><div id="breakResults" role="status"></div></div>`;
    $('#closeStudent').onclick = () => dialog.close();
    $('#breakPlanner').onsubmit = planBreak;
  }
  async function planBreak(event) {
    event.preventDefault();
    const form = event.target, values = new FormData(form), out = $('#breakResults');
    const from = building(values.get('origin')), to = building(values.get('destination')) || from, budget = Number(values.get('minutes'));
    if (!from || !to || !Number.isFinite(budget) || budget < 20 || budget > 240) { out.textContent = 'Choose a starting building and between 20 and 240 minutes.'; return; }
    out.textContent = 'Checking mapped walking paths…';
    try {
      await window.WalkRouting.load();
      const tree = window.WalkRouting.paths(centroid(from)), back = window.WalkRouting.paths(centroid(to));
      const choices = buildings().filter(item => /Melville|Wang|^Stony Brook Union$/.test(item.name)).map(item => {
        const there = window.WalkRouting.routeTo(item, tree), returning = window.WalkRouting.routeTo(item, back);
        if (!there || !returning) return null;
        const walk = Math.ceil((there.meters + returning.meters) / 75), study = budget - walk - 10;
        return { item, walk, study };
      }).filter(choice => choice && choice.study >= 15).sort((a, b) => b.study - a.study);
      out.innerHTML = choices.length ? '<p>Mapped walking estimates include a 10-minute buffer. Seats, opening hours, and accessible paths are not confirmed.</p>' + choices.map(({ item, walk, study }) => `<article class="student-card"><h3>${esc(item.name)}</h3><strong>About ${study} min to study</strong><p>${walk} min total walking + 10 min buffer</p><button type="button" data-map="${esc(item.id)}">Show on map ↗</button></article>`).join('') : '<p>No option fits with at least 15 minutes to study. Increase your time or choose a nearer starting building.</p>';
    } catch (error) { out.textContent = error.message || 'Walking paths could not load. Try again.'; }
  }
  launcher.onclick = () => { if (!buildings().length) return toast('Campus buildings are still loading.'); render(); dialog.showModal(); };
  dialog.addEventListener('close', () => launcher.focus());
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-map]');
    const item = button && building(button.dataset.map);
    if (item) { dialog.close(); window.studyCampus.home(); window.studyCampus.select(item); }
  });
})();
