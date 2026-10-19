// Site-wide behaviour: theme, navigation, project filters, copy-to-clipboard,
// scroll-spy and reveal-on-scroll. No dependencies.
(() => {
  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Theme -------------------------------------------------------------
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

  $$('.theme-toggle').forEach((btn) => {
    const sync = () => btn.setAttribute('aria-label',
      currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    sync();
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
      sync();
      document.dispatchEvent(new CustomEvent('themechange'));
    });
    systemDark.addEventListener('change', sync);
  });

  // ---- Header: border on scroll, mobile menu ------------------------------
  const header = $('.site-header');
  const progress = $('.progress');
  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--progress', max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menuBtn = $('.menu-toggle');
  const menu = $('#nav-links');
  if (menuBtn && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  // ---- Toast + copy to clipboard -------------------------------------------
  let toastTimer;
  const toast = (msg) => {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
  };

  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        toast('Email address copied');
      } catch (e) {
        window.location.href = `mailto:${text}`;
      }
    });
  });

  // ---- Project filters -------------------------------------------------------
  const filterBar = $('.filters');
  if (filterBar) {
    const cards = $$('.project');
    const status = $('.filter-status');
    const buttons = $$('.filter', filterBar);

    buttons.forEach((btn) => {
      const f = btn.dataset.filter;
      const n = f === 'all' ? cards.length : cards.filter((c) => c.dataset.tags.split(' ').includes(f)).length;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = n;
      btn.appendChild(count);

      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        let shown = 0;
        cards.forEach((card) => {
          const match = f === 'all' || card.dataset.tags.split(' ').includes(f);
          const wasHidden = card.hidden;
          card.hidden = !match;
          if (match) {
            shown += 1;
            if (wasHidden && !reducedMotion) {
              card.classList.remove('is-entering');
              void card.offsetWidth; // restart the animation
              card.classList.add('is-entering');
            }
          }
        });
        // a lone result takes the full row instead of half of it
        cards.forEach((card) => card.classList.toggle('is-solo', shown === 1 && !card.hidden));
        if (status) status.textContent = `Showing ${shown} of ${cards.length}`;
      });
    });
  }

  // ---- Scroll-spy (home nav and project-page table of contents) --------------
  const spy = (links, offsetRatio = 0.35) => {
    const pairs = links
      .map((a) => [a, document.getElementById(decodeURIComponent(a.hash.slice(1)))])
      .filter(([, sec]) => sec);
    if (!pairs.length) return;
    const update = () => {
      const line = window.innerHeight * offsetRatio;
      let active = null;
      for (const [a, sec] of pairs) {
        if (sec.getBoundingClientRect().top - line <= 0) active = a;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) active = pairs[pairs.length - 1][0];
      pairs.forEach(([a]) => {
        if (a === active) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  };
  spy($$('.nav-links a[href^="#"]'));
  spy($$('.toc a[href^="#"]'), 0.3);

  // ---- Reveal on scroll ---------------------------------------------------------
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // ---- Footer year ------------------------------------------------------------
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
