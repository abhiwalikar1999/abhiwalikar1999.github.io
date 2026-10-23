// Visit statistics (GoatCounter) and a phone alert (ntfy) for the actions that
// matter: CV download, live demo, GitHub, LinkedIn and email.
// Runs only on the live site and keeps everything in memory for the current
// page: nothing is written to a visitor's browser storage.
// Open the site once with #me in the address to exclude your own browser
// (stored on your device only), and with #notme to include it again.
(() => {
  const CONFIG = {
    liveHosts: ['abhiwalikar1999.github.io'],
    goatcounter: 'abhiwalikar',              // GoatCounter site code: https://abhiwalikar.goatcounter.com
    ntfyTopic: 'aw-XbXvsICZmCHwsLh_sebkuQAc', // subscribe to this topic in the ntfy app
  };

  const params = new URLSearchParams(location.search);
  const test = params.has('aw-test');

  // The opt-out flag lives only on the site owner's own devices.
  try {
    if (location.hash === '#me') localStorage.setItem('aw-skip', '1');
    if (location.hash === '#notme') localStorage.removeItem('aw-skip');
    if (!test && localStorage.getItem('aw-skip') === '1') return;
  } catch (e) { /* storage unavailable */ }
  if (!test && !CONFIG.liveHosts.includes(location.hostname)) return;

  // Where this page view came from: a tagged link (?ref=cv), another site, or this site.
  let host = '';
  try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* ignore */ }
  const ref = params.get('ref');
  const source = ref ? `${ref} link`
    : host === location.hostname ? 'browsing the site'
    : host ? host.replace(/^www\./, '')
    : 'direct';

  // Statistics.
  if (CONFIG.goatcounter) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.dataset.goatcounter = `https://${CONFIG.goatcounter}.goatcounter.com/count`;
    document.head.appendChild(s);
  }
  const countEvent = (path, title) => {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path, title, event: true });
    }
  };

  // Phone alert, at most once per action per page view.
  const sent = new Set();
  const device = () => `${/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'phone' : 'desktop'} · ${navigator.language || 'unknown language'}`;
  const notify = (key, title, priority, tags) => {
    if (!CONFIG.ntfyTopic || sent.has(key)) return;
    sent.add(key);
    const q = new URLSearchParams({
      title: (test ? '[test] ' : '') + title,
      message: `Page: ${location.pathname}\nFrom: ${source}\nDevice: ${device()}`,
      priority: String(priority),
      tags,
      click: location.href.split('#')[0],
    });
    fetch(`https://ntfy.sh/${CONFIG.ntfyTopic}?${q}`, { method: 'POST', keepalive: true }).catch(() => {});
  };

  // A visit through a tagged link (CV, LinkedIn, an application) is worth an alert too.
  if (ref) notify('visit', `Portfolio opened from your ${ref} link`, 3, 'eyes');

  // [key, alert title, priority, emoji tag]
  const classify = (href) => {
    if (/Walikar_CV\.pdf/i.test(href)) return ['cv', 'CV downloaded', 4, 'page_facing_up'];
    if (/context-graph-assistant\./i.test(href)) return ['demo-llm', 'LLM live demo opened', 4, 'rocket'];
    if (/explainable-kg-classification\.[^/]*azurecontainerapps\.io/i.test(href)) return ['demo-kg', 'KG live demo opened', 4, 'rocket'];
    const gh = href.match(/github\.com\/abhiwalikar1999\/?([^/?#]*)/i);
    if (gh) return [`github-${gh[1] || 'profile'}`, gh[1] ? `GitHub repo opened: ${gh[1]}` : 'GitHub profile opened', 3, 'computer'];
    if (/linkedin\.com\/in\//i.test(href)) return ['linkedin', 'LinkedIn profile opened', 4, 'briefcase'];
    if (/^mailto:/i.test(href)) return ['email', 'Email link clicked', 4, 'envelope'];
    return null;
  };

  const onClick = (e) => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    if (e.target.closest('[data-copy]')) {
      countEvent('email-copied', 'Email address copied');
      notify('email-copied', 'Email address copied', 4, 'envelope');
      return;
    }
    const a = e.target.closest('a[href]');
    const hit = a && classify(a.href);
    if (!hit) return;
    const [key, title, priority, tags] = hit;
    countEvent(`click-${key}`, title);
    notify(key, title, priority, tags);
  };
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);
})();
