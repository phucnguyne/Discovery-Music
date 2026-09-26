// src/lib/sidebar-toggle.client.ts
// Loaded once from Layout.astro. Delegated click (survives Astro view
// transitions, same reasoning as playing-indicator.client.ts) toggling
// the mobile nav's `hidden` attribute — desktop never shows the button
// that would trigger this, and CSS force-shows the nav there regardless
// (see Sidebar.astro's >900px override).
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('#sidebar-toggle');
  if (!btn) return;

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const isOpen = !nav.hidden;
  nav.hidden = isOpen;
  btn.setAttribute('aria-expanded', String(!isOpen));
});

// A client-side route change (view transition) should close the menu
// again rather than leaving it open over the new page's content.
document.addEventListener('astro:page-load', () => {
  const nav = document.getElementById('sidebar-nav');
  const btn = document.getElementById('sidebar-toggle');
  if (nav && window.matchMedia('(max-width: 900px)').matches) {
    nav.hidden = true;
    btn?.setAttribute('aria-expanded', 'false');
  }
});