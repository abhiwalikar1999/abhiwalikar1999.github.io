// Visit statistics (GoatCounter) and a phone alert (ntfy) for the actions that
// matter: CV download, live demo, GitHub, LinkedIn and email.
// Runs only on the live site. Open the site once with #me in the address to
// exclude your own browser, and with #notme to include it again.
(() => {
  const CONFIG = {
    liveHosts: ['abhiwalikar1999.github.io'],
    goatcounter: '',                         // GoatCounter site code, e.g. 'abhiwalikar'
    ntfyTopic: 'aw-XbXvsICZmCHwsLh_sebkuQAc', // subscribe to this topic in the ntfy app
  };

  const get = (s, k) => { try { return s.getItem(k); } catch (e) { return null; } };
  const set = (s, k, v) => { try { s.setItem(k, v); } catch (e) { /* storage unavailable */ } };
  const params = new URLSearchParams(location.search);
  const test = params.has('aw-test');

  if (location.hash === '#me') set(localStorage, 'aw-skip', '1');
  if (location.hash === '#notme') { try { localStorage.removeItem('aw-skip'); } catch (e) { /* ignore */ } }
  if (!test && (get(localStorage, 'aw-skip') === '1' || !CONFIG.liveHosts.includes(location.hostname))) return;

  // Where this visit came from: a tagged link (?ref=cv) or the referring site.
  let source = get(sessionStorage, 'aw-src');
  if (!source) {
    let host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* ignore */ }
    const ref = params.get('ref');
    source = ref ? `${ref} link` : (host && host !== location.hostname ? host.replace(/^www\./, '') : 'direct');
    set(sessionStorage, 'aw-src', source);
  }

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

  // Phone alert, at most once per action per visit.
  const device = () => `${/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'phone' : 'desktop'} · ${navigator.language || 'unknown language'}`;
  const notify = (key, title, priority, tags) => {
    if (!CONFIG.ntfyTopic) return;
    const sent = get(sessionStorage, 'aw-sent') || '';
    if (sent.split('|').includes(key)) return;
    set(sessionStorage, 'aw-sent', `${sent}|${key}`);
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
  const ref = params.get('ref');
  if (ref) notify('visit', `Portfolio opened from your ${ref} link`, 3, 'eyes');

  // [key, alert title, priority, emoji tag]
  const classify = (href) => {
    if (/Walikar_CV\.pdf/i.test(href)) return ['cv', 'CV downloaded', 4, 'page_facing_up'];
    if (/context-graph-assistant\.onrender\.com/i.test(href)) return ['demo', 'Live demo opened', 4, 'rocket'];
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
