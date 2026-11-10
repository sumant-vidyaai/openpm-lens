import type { ReactNode } from 'react';
import { DEFAULT_THRESHOLDS } from '@spashta/core';

/** The Spashta mark: three status dots, red, amber and green. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 52 32" aria-hidden="true" className="mark">
      <circle cx="12" cy="16" r="11" fill="#e5484d" />
      <circle cx="26" cy="16" r="11" fill="#ffb62e" style={{ mixBlendMode: 'normal' }} />
      <circle cx="40" cy="16" r="11" fill="#27a45f" />
    </svg>
  );
}

export function Icon({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  );
}

export const ICONS = {
  upload: <><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5" /><path d="M4 16v3h16v-3" /></>,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  read: <><path d="M5 4h14v16H5z" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></>,
  start: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  plan: <><path d="M4 6h16M4 12h10M4 18h13" /></>,
  track: <><path d="M4 19V5M4 19h16" /><path d="M8 15l4-4 3 2 4-6" /></>,
  control: <><path d="M12 3.5l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  close: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  report: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h7" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>,
  scale: <><path d="M12 4v16M6 20h12" /><path d="M5 8h14" /><path d="M5 8l-2.5 6a3 3 0 005 0zM19 8l-2.5 6a3 3 0 005 0z" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  code: <><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
  book: <><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
};

const R_MIN = 0.6, R_MAX = 1.4;

/** A half-circle gauge for an index (CPI or SPI) with red, amber and green arcs from the thresholds. */
export function Gauge({ label, value, className }: { label: string; value: number; className?: string }) {
  const cx = 120, cy = 118, r = 92, sw = 20;
  const ang = (v: number) => Math.PI * (1 - (Math.min(R_MAX, Math.max(R_MIN, v)) - R_MIN) / (R_MAX - R_MIN));
  const pt = (v: number, rad = r) => `${(cx + rad * Math.cos(ang(v))).toFixed(1)} ${(cy - rad * Math.sin(ang(v))).toFixed(1)}`;
  const arc = (a: number, b: number) => `M ${pt(a)} A ${r} ${r} 0 0 1 ${pt(b)}`;
  const { amberMin, greenMin } = DEFAULT_THRESHOLDS;
  const band = value >= greenMin ? 'green' : value >= amberMin ? 'amber' : 'red';
  const word = band === 'green' ? 'green zone' : band === 'amber' ? 'amber zone' : 'red zone';
  const desc = `${label} is ${value.toFixed(2)}, in the ${word}.`;
  const nx = cx + (r - 6) * Math.cos(ang(value)), ny = cy - (r - 6) * Math.sin(ang(value));
  return (
    <svg className={`gauge ${className ?? ''}`} viewBox="0 0 240 172" role="img" aria-label={desc}>
      <title>{desc}</title>
      <path d={arc(R_MIN, amberMin)} stroke="#e5484d" strokeWidth={sw} fill="none" />
      <path d={arc(amberMin, greenMin)} stroke="#ffb62e" strokeWidth={sw} fill="none" />
      <path d={arc(greenMin, R_MAX)} stroke="#27a45f" strokeWidth={sw} fill="none" />
      <line className="gauge-needle" x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="9" fill="currentColor" />
      <text x={cx} y={cy + 46} textAnchor="middle" className="gauge-value">{value.toFixed(2)}</text>
    </svg>
  );
}

/** A browser-style frame around a product screenshot. */
export function Frame({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <figure className={`frame ${className ?? ''}`}>
      <div className="frame-bar" aria-hidden="true"><i /><i /><i /></div>
      <img src={`${import.meta.env.BASE_URL}img/${src}`} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" width={960} height={640} />
    </figure>
  );
}

/** Your file stays in your browser tab; nothing travels to a server. */
export function PrivacyDiagram() {
  return (
    <svg className="privacy-art" viewBox="0 0 560 220" role="img" aria-label="Your file is read inside your browser tab on your device. No copy goes to a server or the cloud.">
      <title>Your file stays on your device</title>
      <rect x="8" y="30" width="360" height="170" rx="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="7 7" opacity=".55" />
      <text x="24" y="54" className="pa-cap">Your device</text>
      <rect x="28" y="84" width="92" height="78" rx="10" fill="#8fe3e8" />
      <path d="M52 108h44M52 124h44M52 140h28" stroke="#0b1d26" strokeWidth="4" strokeLinecap="round" />
      <text x="74" y="182" textAnchor="middle" className="pa-cap" dy="0">Project file</text>
      <path d="M126 123h58" stroke="currentColor" strokeWidth="3" strokeLinecap="round" markerEnd="url(#pa-ar)" />
      <defs><marker id="pa-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1l7 4-7 4z" fill="currentColor" /></marker></defs>
      <rect x="190" y="72" width="164" height="104" rx="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M190 96h164" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="204" cy="84" r="3.5" fill="#e5484d" /><circle cx="216" cy="84" r="3.5" fill="#ffb62e" /><circle cx="228" cy="84" r="3.5" fill="#27a45f" />
      <rect x="206" y="112" width="48" height="48" rx="8" fill="#ffb62e" />
      <path d="M268 122h70M268 138h52M268 154h62" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      <text x="272" y="196" textAnchor="middle" className="pa-cap" dx="-8">Spashta in a browser tab</text>
      <path d="M368 123h70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" opacity=".6" />
      <g transform="translate(436 96)">
        <path d="M30 72c-16 0-24-8-24-19 0-9 7-16 16-17 3-12 13-20 26-20 14 0 25 9 27 22 10 1 17 8 17 17 0 10-8 17-19 17z" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".6" />
        <path d="M28 4l76 74" stroke="#e5484d" strokeWidth="6" strokeLinecap="round" />
      </g>
      <text x="486" y="196" textAnchor="middle" className="pa-cap">No upload</text>
    </svg>
  );
}

/** A blank value is left out and listed, never counted as zero. */
export function MissingDiagram() {
  return (
    <div className="missing-art" role="group" aria-label="A made-up scoring table where one option has a blank score">
      <table>
        <caption className="sr-only">Made-up scores: a blank is not turned into zero</caption>
        <thead><tr><th scope="col">Option</th><th scope="col">Price</th><th scope="col">Support</th><th scope="col">Result</th></tr></thead>
        <tbody>
          <tr><th scope="row">A</th><td>8</td><td>7</td><td className="ok">7.5</td></tr>
          <tr><th scope="row">B</th><td>7.2</td><td>7</td><td className="ok">7.1</td></tr>
          <tr className="gap"><th scope="row">C</th><td>9</td><td className="blank">blank</td><td className="warn">Not scored</td></tr>
        </tbody>
      </table>
      <p>Equal weights, made-up numbers. C is left out and listed, never quietly scored as zero.</p>
    </div>
  );
}
