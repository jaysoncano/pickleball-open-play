/**
 * The PaddleStack mark: a paddle and ball on the lime-to-emerald tile.
 * Single source for the header logo, `app/icon.svg` (kept identical by
 * `logo.test.ts`), and the generated Apple touch icon.
 */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#bef264"/>
      <stop offset="1" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect x="0" y="4" width="64" height="60" rx="16" fill="#15803d"/>
  <rect x="0" y="0" width="64" height="60" rx="16" fill="url(#tile)"/>
  <g transform="rotate(-35 30 30)">
    <rect x="26" y="37" width="8" height="18" rx="4" fill="#b45309"/>
    <ellipse cx="30" cy="23" rx="15" ry="16" fill="#ef4444"/>
    <ellipse cx="30" cy="23" rx="15" ry="16" fill="none" stroke="#b91c1c" stroke-width="2.5"/>
    <ellipse cx="25" cy="17" rx="4.5" ry="3" fill="#fca5a5" opacity="0.8"/>
  </g>
  <circle cx="49" cy="15" r="6.5" fill="#ffffff" stroke="#d1fae5" stroke-width="1.5"/>
</svg>
`;

/** The mark as a data URI, for `<img>` and generated images. */
export const LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;
