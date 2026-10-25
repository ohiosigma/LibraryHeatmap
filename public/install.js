(() => {
  let prompt = null;
  const panel = document.createElement('section');
  panel.className = 'install-panel';
  panel.innerHTML = '<img src="icons/icon-192.png" width="52" height="52" alt=""><div><h3>StudySignal, on your home screen.</h3><p>Open it in its own app window, ready for your next study break.</p></div><button class="primary" id="installStudySignal" hidden>Install StudySignal</button><p id="installInstructions"></p><small>Study activity and transit need an internet connection. Saved spaces stay in this browser or installed app; they do not sync between devices.</small><p id="installStatus" role="status"></p>';
  document.querySelector('#infoDialog').prepend(panel);
  const button = panel.querySelector('button'), instructions = panel.querySelector('#installInstructions'), status = panel.querySelector('#installStatus');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function render() {
    const installed = standalone();
    button.hidden = installed || !prompt;
    instructions.textContent = installed ? 'You’re using StudySignal as an installed app.' : /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'On iPhone or iPad: open in Safari, tap Share → Add to Home Screen, then Add. If shown, keep Open as Web App enabled.' : /Android/.test(navigator.userAgent) ? 'In Chrome, open the menu → Install app or Add to Home screen. If available, use the install button here.' : 'Use your browser’s install icon or menu to install StudySignal. On a phone, use Add to Home Screen.';
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; render(); });
  button.onclick = async () => {
    if (!prompt) return;
    const request = prompt; prompt = null; button.hidden = true;
    try { await request.prompt(); const result = await request.userChoice; status.textContent = result.outcome === 'accepted' ? 'Installation requested. Look for StudySignal in your apps.' : 'You can install later from your browser menu.'; }
    catch { status.textContent = 'Use your browser menu to install StudySignal.'; }
    render();
  };
  window.addEventListener('appinstalled', () => { prompt = null; status.textContent = 'StudySignal installed. Open it from your home screen or app launcher.'; render(); });
  render();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => { status.textContent = 'Offline support could not start. You can still use StudySignal while connected.'; }));
  }
})();
