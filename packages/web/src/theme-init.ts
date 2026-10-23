// Runs before the page paints so there is no flash of the wrong colour theme.
try {
  const saved = localStorage.getItem('openpm-lens-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  const a = localStorage.getItem('openpm-lens-accent');
  if (a === 'blue' || a === 'violet' || a === 'orange') document.documentElement.dataset.accent = a;
} catch {
  /* storage may be blocked; the system setting is used instead */
}
