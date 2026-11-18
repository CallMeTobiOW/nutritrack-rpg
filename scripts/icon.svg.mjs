// Shared SVG source for the app icon (original artwork). `scale` shrinks the
// crest for maskable icons, which need a safe zone; `rounded` adds corners
// for the favicon (iOS/Android round home-screen icons themselves).
export function iconSvg({ size = 512, scale = 1, rounded = false } = {}) {
  const r = rounded ? 112 : 0;
  const t = (1 - scale) * 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="80%">
      <stop offset="0" stop-color="#16213f"/>
      <stop offset="0.6" stop-color="#0a1022"/>
      <stop offset="1" stop-color="#05070e"/>
    </radialGradient>
    <linearGradient id="hex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f97316"/></linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="${r}" fill="url(#bg)"/>
  <g transform="translate(${t} ${t}) scale(${scale})" filter="url(#glow)">
    <polygon points="256,62 424,159 424,353 256,450 88,353 88,159" fill="none" stroke="url(#hex)" stroke-width="22" stroke-linejoin="round"/>
    <path d="M166 296 L256 214 L346 296" fill="none" stroke="url(#gold)" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M186 356 L256 294 L326 356" fill="none" stroke="url(#hex)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M256 116 L284 150 L256 184 L228 150 Z" fill="url(#gold)"/>
  </g>
</svg>`;
}
