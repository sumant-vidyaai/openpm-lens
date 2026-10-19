// Runs before the page paints so there is no flash of the wrong colour theme.
try {
  const saved = localStorage.getItem('openpm-lens-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {
  /* storage may be blocked; the system setting is used instead */
}
