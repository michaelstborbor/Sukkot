/** Decorative panorama of hills over the sea at dusk, drawn in SVG so it weighs a few KB on mobile data. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 1440 640" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="h-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1F3A" />
          <stop offset="0.55" stopColor="#1B3A66" />
          <stop offset="1" stopColor="#C8962E" />
        </linearGradient>
        <linearGradient id="h-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0F766E" stopOpacity="0.85" />
          <stop offset="1" stopColor="#061224" />
        </linearGradient>
        <radialGradient id="h-sun" cx="0.72" cy="0.62" r="0.25">
          <stop offset="0" stopColor="#FCE7B2" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FCE7B2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="640" fill="url(#h-sky)" />
      <rect width="1440" height="640" fill="url(#h-sun)" />
      <circle cx="1040" cy="400" r="46" fill="#FCE7B2" opacity="0.9" />
      <path d="M0 430 C 180 330 330 360 460 300 S 760 250 900 330 S 1200 300 1440 360 V640 H0Z" fill="#12294B" />
      <path d="M0 470 C 220 410 380 440 560 400 S 900 380 1080 430 S 1300 420 1440 440 V640 H0Z" fill="#0E2442" />
      <g fill="#F1E4C6" opacity="0.85">
        {Array.from({ length: 46 }).map((_, i) => {
          const x = 60 + ((i * 97) % 1320);
          const y = 440 + ((i * 53) % 60) - (x > 400 && x < 900 ? 30 : 0);
          return <rect key={i} x={x} y={y} width={3 + (i % 3)} height={2 + (i % 2)} rx="1" />;
        })}
      </g>
      <path d="M0 520 C 300 500 520 530 760 512 S 1180 500 1440 515 V640 H0Z" fill="url(#h-sea)" />
      <path d="M980 540 h120 M1020 556 h80 M900 572 h60" stroke="#FCE7B2" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
