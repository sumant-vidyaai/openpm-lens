// Runs before the page paints so there is no flash of the wrong colour theme.
// The 'openpm-lens-*' keys are what earlier versions used; they are read once and copied to the new names.
try {
  const saved = localStorage.getItem('spashta-theme') ?? localStorage.getItem('openpm-lens-theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved;
    if (localStorage.getItem('spashta-theme') === null) localStorage.setItem('spashta-theme', saved);
  }
  const a = localStorage.getItem('spashta-accent') ?? localStorage.getItem('openpm-lens-accent');
  if (a === 'blue' || a === 'violet' || a === 'orange') {
    document.documentElement.dataset.accent = a;
    if (localStorage.getItem('spashta-accent') === null) localStorage.setItem('spashta-accent', a);
  }
} catch {
  /* storage may be blocked; the system setting is used instead */
}
