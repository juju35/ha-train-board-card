// ---------------------------------------------------------------------------
// The illustration: a station at the right of a 320 × 78 banner (hills, station building with its canopy, arched
// windows and clock, catenary, platform, track) and a generic train. The left of the banner (x < 150) is open
// sky: the card's text sits there, and nothing moves under it (the train fades in and out at x 150–180).
// Drawn in the card's own colours (no operator livery, no logo, no external picture).
// ---------------------------------------------------------------------------

// Sky positions of the stars (night).
const TB_STARS = [
  [158, 7, 0.7],
  [171, 23, 0.5],
  [186, 5, 0.6],
  [199, 30, 0.45],
  [214, 9, 0.8],
  [229, 21, 0.5],
  [246, 4, 0.6],
  [289, 6, 0.7],
  [306, 15, 0.55],
  [316, 4, 0.5],
  [262, 11, 0.4],
];

// The train, nose to the right, wheels on the rail at y 73.2 (drawn at x 0–112 then moved to the platform).
const tbTrainSvg = (uid) => `<g class="tb-train">
    <g class="tb-panto"><path d="M26 2 31.5 -3.2 27 -7.6" /><path d="M22.5 -7.6h9" /><circle class="tb-spark" cx="27" cy="-7.8" r="1.6"/></g>
    <path class="tb-body" d="M2 3.4Q2 1.8 4 1.8H82C95 1.8 105.5 6.4 111.6 13.2Q112.6 14.6 112 16.2Q111.6 17 110.4 17H3.6Q2 17 2 15.4Z"/>
    <clipPath id="tb-clip-${uid}"><path d="M2 3.4Q2 1.8 4 1.8H82C95 1.8 105.5 6.4 111.6 13.2Q112.6 14.6 112 16.2Q111.6 17 110.4 17H3.6Q2 17 2 15.4Z"/></clipPath>
    <g clip-path="url(#tb-clip-${uid})"><rect class="tb-stripe" x="0" y="11.2" width="114" height="2.1"/><rect class="tb-fillet" x="0" y="13.9" width="114" height=".8"/></g>
    <rect class="tb-glass" x="8" y="4.6" width="66" height="4.2" rx="1.2"/>
    <path class="tb-glass" d="M84.5 4.4C92.6 4.6 99.6 7.2 104.6 10.6H86.2Z"/>
    <path class="tb-door" d="M22 3.6v12M27 3.6v12M55 3.6v12M60 3.6v12"/>
    <circle class="tb-lamp" cx="110.2" cy="14.6" r=".9"/>
    <path class="tb-beam" d="M111 14.6L150 9V20Z"/>
    <rect class="tb-bogie" x="10" y="16.6" width="22" height="2.6" rx="1.2"/><rect class="tb-bogie" x="78" y="16.6" width="22" height="2.6" rx="1.2"/>
    <circle class="tb-wheel" cx="15" cy="19" r="1.8"/><circle class="tb-wheel" cx="27" cy="19" r="1.8"/><circle class="tb-wheel" cx="83" cy="19" r="1.8"/><circle class="tb-wheel" cx="95" cy="19" r="1.8"/>
  </g>`;

// The whole banner picture. `uid` keeps the ids of each card's gradients apart on a page with several cards.
const tbSceneSvg = (uid) => {
  const stars = TB_STARS.map(([x, y, r], i) => `<circle class="tb-star${i % 3 ? "" : " tw"}" cx="${x}" cy="${y}" r="${r}"/>`).join("");
  const windows = [246, 265, 284].map((x) => `<path class="tb-win" d="M${x} 56V47.5a4.5 4.5 0 0 1 9 0V56Z"/>`).join("");
  const lamp = (x) =>
    `<g class="tb-lampost"><circle class="tb-halo" cx="${x}" cy="44" r="7" fill="url(#tb-halo-${uid})"/><rect class="tb-pole" x="${x - 0.6}" y="44" width="1.2" height="14"/><rect class="tb-lamphead" x="${x - 2}" y="42.6" width="4" height="1.8" rx=".8"/></g>`;
  const pole = (x) => `<rect class="tb-pole" x="${x - 0.8}" y="37" width="1.6" height="37"/><path class="tb-arm" d="M${x} 39.5H${x + 7}V45.6"/>`;
  return `<div class="tb-track" aria-hidden="true"></div><svg class="tb-scene" viewBox="0 0 320 78" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="tb-fade-${uid}" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="184" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="tb-mask-${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="78"><rect x="0" y="0" width="320" height="78" fill="url(#tb-fade-${uid})"/></mask>
      <radialGradient id="tb-halo-${uid}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="tb-sky">
      <g class="tb-day"><circle class="tb-sun" cx="206" cy="13" r="6"/><path class="tb-cloud" d="M160 23a4 4 0 0 1 6-3.4 5 5 0 0 1 9.4 1.4 3 3 0 0 1 .6 6H162a3 3 0 0 1-2-4Z"/><path class="tb-cloud" d="M226 12a3.4 3.4 0 0 1 5-2.8 4.2 4.2 0 0 1 8 1.2 2.6 2.6 0 0 1 .4 5H228a2.6 2.6 0 0 1-2-3.4Z"/></g>
      <g class="tb-night">${stars}<path class="tb-moon" d="M210 7.4a6.4 6.4 0 1 0 5.6 9.6 5.2 5.2 0 1 1-5.6-9.6Z"/></g>
    </g>
    <path class="tb-hill far" d="M150 60C172 42 196 36 222 46C246 34 280 28 320 38V60Z"/>
    <path class="tb-hill" d="M150 62C170 50 190 47 214 54C236 45 262 44 290 50C302 47 312 47 320 48V62Z"/>
    <g class="tb-station">
      <path class="tb-roof" d="M236 27L270 14L304 27Z"/>
      <rect class="tb-wall" x="239" y="26" width="62" height="32"/>
      <rect class="tb-cornice" x="237" y="25.4" width="66" height="1.8" rx=".4"/>
      <circle class="tb-clock" cx="270" cy="20.6" r="4.2"/><path class="tb-tick" d="M270 17.2v.9M270 23.1v.9M266.6 20.6h.9M272.5 20.6h.9"/>
      <path class="tb-hand hh" d="M270 20.6V18.4"/><path class="tb-hand mm" d="M270 20.6V17.4"/>
      ${windows}
      <path class="tb-canopy" d="M224 38.4H314L310 41.4H228Z"/><path class="tb-post" d="M230 41.4V58M308 41.4V58"/>
    </g>
    ${pole(164)}${pole(222)}
    <path class="tb-wire" d="M150 45.6H320M171 45.6l25 .5 26-.5M229 45.6l45 .6 46-.6"/>
    <rect class="tb-plat" x="160" y="58" width="160" height="9"/><rect class="tb-plat-top" x="160" y="58" width="160" height="1.4"/><rect class="tb-safety" x="160" y="60" width="160" height=".9"/>
    ${lamp(196)}${lamp(314)}
    <g mask="url(#tb-mask-${uid})">
      <g class="tb-move"><g transform="translate(180 52.2)">${tbTrainSvg(uid)}</g></g>
    </g>
  </svg>`;
};

// The illustration's colours and animations, day and night. The train waits at the platform and leaves to the
// right (departures), or comes in from the left and stops (arrivals): each tab has its own keyframes, so that the
// animation starts over when the tab changes.
const TB_SCENE_STYLE = `
  .banner { position: relative; overflow: hidden; height: var(--tb-banner-h, 90px); color: #10283f;
            background: linear-gradient(90deg, #f3f9ff 0%, #e2f0fc 38%, #c4e1f7 100%); }
  .banner.night { color: #fff; background: linear-gradient(90deg, #2c4068 0%, #1b2b4e 42%, #0f1a34 100%); }
  .tb-scene { position: absolute; right: 0; bottom: 0; width: 100%; height: 100%; overflow: hidden; }
  .tb-night, .night .tb-day { display: none; }
  .night .tb-night { display: inline; }
  .tb-sun { fill: #ffd65a; }
  .tb-cloud { fill: #fff; opacity: .9; }
  .tb-star { fill: #fff; }
  .tb-star.tw { animation: tb-twinkle 3.2s ease-in-out infinite alternate; }
  .tb-moon { fill: #f4f1dc; }
  .tb-hill { fill: #a4cf96; } .tb-hill.far { fill: #c9e3bf; }
  .night .tb-hill { fill: #1d3045; } .night .tb-hill.far { fill: #23395a; }
  .tb-roof { fill: #c46b4e; } .night .tb-roof { fill: #6e3f36; }
  .tb-wall { fill: #f1e6d3; } .night .tb-wall { fill: #8d8577; }
  .tb-cornice { fill: #d8c8ad; } .night .tb-cornice { fill: #6f685d; }
  .tb-win { fill: #8fb9dc; stroke: #d2c0a2; stroke-width: .7; } .night .tb-win { fill: #ffc45e; stroke: #b4935a; }
  .night .tb-win { filter: drop-shadow(0 0 1.6px #ffb347); }
  .tb-clock { fill: #fff; stroke: #5c6b78; stroke-width: .7; } .night .tb-clock { fill: #fff6dc; }
  .tb-tick { stroke: #5c6b78; stroke-width: .5; }
  .tb-hand { stroke: #2b3540; stroke-width: .7; stroke-linecap: round; transform-box: view-box; transform-origin: 270px 20.6px; }
  .tb-hand.mm { animation: tb-turn 6s linear infinite; }
  .tb-hand.hh { animation: tb-turn 72s linear infinite; }
  .tb-canopy { fill: #5d6e7e; } .night .tb-canopy { fill: #3c4856; }
  .tb-post, .tb-arm { stroke: #6b7887; stroke-width: 1; fill: none; }
  .tb-pole { fill: #6b7887; } .night .tb-pole, .night .tb-post, .night .tb-arm { fill: #7a8798; stroke: #7a8798; }
  .tb-wire { stroke: #4b5764; stroke-width: .45; fill: none; } .night .tb-wire { stroke: #8a97a8; }
  .tb-plat { fill: #b9b2a6; } .tb-plat-top { fill: #ddd7cc; } .tb-safety { fill: #f2c200; }
  .night .tb-plat { fill: #4b5462; } .night .tb-plat-top { fill: #5f6977; } .night .tb-safety { fill: #c9a400; }
  .tb-lamphead { fill: #4b5764; } .tb-halo { display: none; }
  .night .tb-halo { display: inline; } .night .tb-lamphead { fill: #ffd27a; }
  /* The track is a 10 px strip under the whole banner, edge to edge, like the ground strip of the other
     illustrated cards: rail on top, sleepers every 10 px, ballast below. The scene is lifted so that the train's
     wheels (y 73.2 of 78) sit on the rail. */
  .tb-track { --rail: #7d8894; --sleeper: #8b6c4d; --ballast: #c3b39d;
              position: absolute; left: 0; right: 0; bottom: 0; height: var(--tb-track-h, 10px);
              background:
                linear-gradient(var(--rail), var(--rail)) 0 0 / 100% 2px no-repeat,
                repeating-linear-gradient(270deg, var(--sleeper) 0 5px, transparent 0 10px) 0 3px / 100% 3px no-repeat,
                var(--ballast); }
  .banner .tb-scene { bottom: calc(var(--tb-track-h, 10px) - var(--tb-banner-h, 90px) * 5.4 / 78); }
  .night .tb-track { --rail: #9aa5b2; --sleeper: #4a3d33; --ballast: #2b3341; }
  .tb-body { fill: #f8fafc; stroke: #c3ccd6; stroke-width: .5; } .night .tb-body { fill: #e3e8ee; }
  .tb-stripe { fill: #2f6fde; } .tb-fillet { fill: #f28c28; }
  .tb-glass { fill: #26323f; } .night .tb-glass { fill: #3a4d63; }
  .tb-door { stroke: #c3ccd6; stroke-width: .45; fill: none; }
  .tb-bogie { fill: #39424c; } .tb-wheel { fill: #2a3139; }
  .tb-panto path { stroke: #4b5764; stroke-width: .7; fill: none; stroke-linejoin: round; }
  .tb-spark { fill: #bfe3ff; opacity: 0; animation: tb-spark 4.6s linear infinite; }
  .tb-lamp { fill: #fff2c2; } .night .tb-lamp { fill: #fffbe6; filter: drop-shadow(0 0 1.4px #fff3b0); }
  .tb-beam { fill: #fff6c8; opacity: 0; } .night .tb-beam { opacity: .35; }
  .tb-move { will-change: transform; }
  .dep .tb-move { animation: tb-depart 9s infinite; }
  .arr .tb-move { animation: tb-arrive 9s infinite; }
  @keyframes tb-depart {
    0% { transform: translateX(0); opacity: 0; }
    6%, 40% { transform: translateX(0); opacity: 1; animation-timing-function: cubic-bezier(.55, 0, .9, .45); }
    82% { transform: translateX(190px); opacity: 1; }
    83%, 100% { transform: translateX(190px); opacity: 0; }
  }
  @keyframes tb-arrive {
    0% { transform: translateX(-176px); opacity: 1; animation-timing-function: cubic-bezier(.12, .6, .3, 1); }
    46%, 90% { transform: translateX(0); opacity: 1; }
    97%, 100% { transform: translateX(0); opacity: 0; }
  }
  @keyframes tb-turn { to { transform: rotate(360deg); } }
  @keyframes tb-twinkle { from { opacity: .35; } to { opacity: 1; } }
  @keyframes tb-spark { 0%, 61% { opacity: 0; } 62% { opacity: 1; } 64%, 79% { opacity: 0; } 80% { opacity: .85; } 81.5%, 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .tb-move, .tb-hand, .tb-spark, .tb-star.tw { animation: none !important; }
  }
`;
