import { useEffect } from 'react';

/** Adds `is-in` to `.reveal` elements as they scroll into view. Without motion preference or IntersectionObserver everything shows at once. */
export function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);
    if (calm) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}
