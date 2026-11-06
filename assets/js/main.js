(() => {
  // Copy legal address
  const btn = document.getElementById('copyAddr');
  if (btn) btn.addEventListener('click', () => {
    const el = document.getElementById('addr'), txt = el.textContent.trim();
    const label = btn.textContent, done = () => { btn.textContent = btn.dataset.done || '✓'; setTimeout(() => (btn.textContent = label), 1800); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (e) { fallback(); }
  });

  // Mobile menu
  const burger = document.querySelector('.burger'), mnav = document.getElementById('mnav');
  if (burger && mnav) {
    const set = open => { burger.setAttribute('aria-expanded', String(open)); mnav.classList.toggle('open', open); };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    mnav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    addEventListener('resize', () => { if (innerWidth >= 900) set(false); });
  }

  // Active section in the nav
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { links.forEach(l => l.classList.remove('active')); const a = map.get(en.target.id); if (a) a.classList.add('active'); } });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(s => io.observe(s));

    // Reveal on scroll
    const rv = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); rv.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => rv.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();
