// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const TB_BASE_STYLE = `
  :host { --tb-accent: #2f7de1; --tb-pro: #8a5cf6; --tb-ok: var(--success-color, #43a047); --tb-warn: var(--warning-color, #ffa600);
          --tb-danger: var(--error-color, #db4437); --tb-muted: var(--secondary-text-color, #727272); }
  ha-card { overflow: hidden; position: relative; container: tbcard / inline-size; }
  /* A size container has no width of its own: in a parent sized by its content the card keeps 400 px. */
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 400px); height: 0; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  [role="button"], [role="tab"] { cursor: pointer; }
  [role="button"]:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .ok { --c: var(--tb-ok); } .warn { --c: var(--tb-warn); } .accent { --c: var(--tb-accent); } .danger { --c: var(--tb-danger); }
  .na { --c: var(--tb-muted); }
  /* The state colour tints the pill; its text mixes it with the text colour to stay readable. */
  .chip { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; line-height: 18px;
          white-space: nowrap; max-width: 100%; box-sizing: border-box; overflow: hidden;
          background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color, #212121)); }
  .chip .txt { overflow: hidden; text-overflow: ellipsis; }
  /* The header's status pill: a dot, then the status. */
  .hpill { gap: 4px; line-height: 16px; min-width: 0; }
  .hpill .txt { min-width: 0; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; }
  .type { flex: none; display: inline-flex; align-items: center; padding: 0 6px; border-radius: 6px; font-size: 11px; font-weight: 700;
          line-height: 18px; letter-spacing: .02em; white-space: nowrap; max-width: 6em; overflow: hidden; text-overflow: ellipsis;
          background: color-mix(in srgb, var(--c) 18%, transparent); color: color-mix(in srgb, var(--c) 55%, var(--primary-text-color, #212121)); }
  .plat { display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 4px; box-sizing: border-box; border-radius: 6px;
          border: 1px solid var(--divider-color, rgba(127,127,127,.35)); font-size: 12px; font-weight: 500; white-space: nowrap; }
  .plat.changed { border-color: var(--tb-warn); color: color-mix(in srgb, var(--tb-warn) 45%, var(--primary-text-color, #212121)); }
  .plat:empty { border-color: transparent; }
  .warning { padding: 16px; color: color-mix(in srgb, var(--tb-warn) 45%, var(--primary-text-color, #212121)); }
  .iconbtn { all: unset; flex: none; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
             color: inherit; box-sizing: border-box; }
  .iconbtn .icon { width: 16px; height: 16px; }
  .iconbtn:hover { background: color-mix(in srgb, currentColor 14%, transparent); }
  .iconbtn:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
`;

// The banner's text, posed on the sky at its left: the scene starts at x 150 of its 320 × 78 picture, drawn to
// the right edge at the banner's height (or less on a narrow card), so the text stops where the scene starts.
export const TB_BANNER_STYLE = `
  /* The round tinted icon (40 px, the brand badge at its bottom right), then the title and the statistics (the mini
     card: the next train), centred on the sky. */
  .htext { position: absolute; left: 12px; top: 4px; bottom: calc(var(--tb-track-h, 10px) + 2px); right: calc(min(53.125cqw, var(--tb-scene-w)) + 4px);
           display: flex; align-items: center; gap: 10px; min-width: 0; }
  .htext .titles { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  /* The header icon takes the status colour of the pill (--c of its ok / warn / danger / na class). */
  .banner .logo { color: color-mix(in srgb, var(--c, var(--tb-accent)) 88%, #10283f); background: rgba(255,255,255,.62);
                  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c, var(--tb-accent)) 22%, transparent); }
  .banner.night .logo { color: color-mix(in srgb, var(--c, #9cc3ff) 70%, #ffffff); background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .banner .badge { box-shadow: 0 0 0 1px rgba(13,42,69,.16), 0 1px 3px rgba(13,42,69,.18); }
  /* Brand badge on the header icon: the logo on a white tile, readable on any theme. */
  .badge { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 5px; padding: 2px; box-sizing: border-box;
           display: grid; place-items: center; background: #fff;
           box-shadow: 0 0 0 1px var(--divider-color, rgba(0,0,0,.12)), 0 0 0 3px var(--card-background-color, #fff); }
  .badge img { width: 100%; height: 100%; object-fit: contain; }
  .htext .name { font-size: 16px; font-weight: 600; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  /* The title row: the title, then the status pill right after it with its whole label (placed by _fitPill). */
  .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .trow .name { flex: 0 1000 auto; min-width: 0; }
  .trow .hpill { flex: none; max-width: none; }
  /* The header's text block is a container (narrow rules below). The whole title and the whole pill do not fit side
     by side (measured by the card, see _fitPill): the pill goes to its own line, under the statistics kept to one
     line; if that does not fit the banner either, the dot alone beside the title. */
  .htext, .header { container: tbhead / inline-size; }
  .titles.below > .trow { display: contents; }
  .titles.below > .trow .hpill { order: 3; align-self: flex-start; max-width: 100%; }
  .titles.below > .stats { order: 2; max-height: 16px; }
  .titles.dot-only > .trow { display: flex; }
  .titles.dot-only > .trow .hpill { order: 0; align-self: center; }
  .titles.dot-only .hpill { padding: 0; background: none !important; overflow: visible; }
  .titles.dot-only .hpill .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  /* Very narrow: the dot alone, back on the title row (the label stays in its tooltip and for screen readers). */
  @container tbcard (max-width: 200px) {
    .titles.below > .trow { display: flex; }
    .titles.below > .trow .hpill { order: 0; align-self: center; }
    .hpill { padding: 0; background: none !important; overflow: visible; }
    .hpill .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  }
  /* On one line when they fit, else wrapped: the « · » that starts a line sits in the negative margin, clipped. */
  .stats { font-size: 12px; line-height: 16px; color: #3d5670; overflow: hidden; max-height: 32px; flex: none; }
  .stats .parts { display: flex; flex-wrap: wrap; margin-left: -12px; }
  .night .stats { color: rgba(255,255,255,.82); }
  .stats span { white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .stats span::before { content: "·"; display: inline-block; width: 12px; text-align: center; }
  /* The mini card's detail button: a 24 px frosted round button in the banner's top right corner. */
  .zoom { width: 24px; height: 24px; }
  .banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; color: #33506b; background: rgba(255,255,255,.55);
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .banner .zoom:hover { background: rgba(255,255,255,.75); }
  .banner.night .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .banner.night .zoom:hover { background: rgba(255,255,255,.22); }
  /* Pills on the sky: a frosted glass under the tint. */
  .banner .chip { background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
  /* Narrow card: no room for the scene beside the text, the sky alone stays. */
  @container tbcard (max-width: 300px) { .tb-scene { display: none; } .htext { right: 12px; } .htext.zoomed { right: 34px; } }
  /* Classic header (illustration: false): a round tinted icon, the title and the statistics. */
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; }
  .logo { height: 40px; width: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--c, var(--tb-accent));
          background: color-mix(in srgb, var(--c, var(--tb-accent)) 16%, transparent); }
  .logo { position: relative; }
  .logo .icon { width: 24px; height: 24px; }
  .header .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .header .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header .stats { color: var(--secondary-text-color); }
  .header { position: relative; }
  .header.zoomed { padding-right: 40px; }
  .header .zoom { position: absolute; top: 12px; right: 12px; color: var(--secondary-text-color); box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
`;

export const TB_FULL_STYLE = `
  .banner { --tb-banner-h: 90px; --tb-scene-w: 244px; }
  .tabs { display: flex; gap: 18px; padding: 0 12px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
  .tab { all: unset; cursor: pointer; padding: 9px 0 7px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color);
         border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .tab.active { color: var(--primary-text-color); border-bottom-color: var(--tb-accent); }
  .tab:hover { color: var(--primary-text-color); }
  .tab:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; border-radius: 2px; }
  .notice { display: flex; align-items: center; gap: 6px; margin: 8px 12px 0; padding: 4px 8px; border-radius: 8px; font-size: 12px;
            background: color-mix(in srgb, var(--tb-warn) 12%, transparent); color: color-mix(in srgb, var(--tb-warn) 40%, var(--primary-text-color, #212121)); }
  .notice .icon { width: 15px; height: 15px; }
  .notice .txt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notice .more { flex: none; font-weight: 600; }
  /* Each row owns its columns (no subgrid): Safari/WebKit mis-distributes a subgrid row's 1fr track when a
     sibling row is hovered, shifting the line badge right. Fixed time/platform tracks keep the columns aligned. */
  .list { display: grid; padding: 4px 4px 8px; }
  .row { display: grid; grid-template-columns: 3.4em minmax(0, 1fr) 2.4em auto; column-gap: 10px;
         align-items: center; padding: 6px 8px; border-radius: 10px; font-size: 13px; min-height: 22px; position: relative; }
  .list.no-plat .row { grid-template-columns: 3.4em minmax(0, 1fr) auto; }
  .row:hover { background: color-mix(in srgb, var(--primary-text-color, #212121) 5%, transparent); }
  .row + .row::before { content: ""; position: absolute; left: 8px; right: 8px; top: 0; border-top: 1px solid var(--divider-color, rgba(127,127,127,.12)); }
  .row:hover::before, .row:hover + .row::before { display: none; }
  .time { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .time.struck { text-decoration: line-through; color: var(--secondary-text-color); }
  .main { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
  .line { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .dest { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  .num { flex: 0 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; min-width: 3ch; }
  .via { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { justify-self: end; min-width: 0; max-width: 100%; display: flex; justify-content: flex-end; }
  .empty { padding: 16px 12px; text-align: center; font-size: 13px; }
  /* Narrow card: the train number and the status text give way first. */
  @container (max-width: 340px) { .num { display: none; } .tabs { gap: 14px; } }
`;

// Train details and station notices, in a popup at the top of the card.
export const TB_DIALOG_STYLE = `
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.42); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 10px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #fff); color: var(--primary-text-color); width: min(94%, 380px); max-height: calc(100% - 20px);
           overflow: auto; box-sizing: border-box; border-radius: 14px; padding: 12px 14px 14px; box-shadow: 0 8px 30px rgba(0,0,0,.35);
           display: flex; flex-direction: column; gap: 10px; }
  .mhead { display: flex; align-items: center; gap: 8px; }
  .mtitle { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .mtitle b { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mtitle span { font-size: 12px; }
  .mhead .iconbtn { color: var(--secondary-text-color); margin: -4px -6px -4px 0; }
  .facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; font-size: 13px; margin: 0; }
  .facts dt { color: var(--secondary-text-color); }
  .facts dd { margin: 0; font-weight: 500; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .sect-title { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 4px; }
  .stops { display: flex; flex-wrap: wrap; gap: 4px; }
  .stop { font-size: 12px; padding: 1px 8px; border-radius: 10px; background: var(--secondary-background-color, rgba(127,127,127,.12)); }
  .stop .muted { margin-left: 4px; }
  .msgs { margin: 0; padding-left: 18px; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
`;

export const TB_MINI_STYLE = `
  .banner { --tb-banner-h: 90px; --tb-scene-w: 218px; }
  .htext { gap: 8px; }
  .htext .titles { gap: 1px; }
  .nt-time { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .nt-time b { font-size: 20px; font-weight: 700; line-height: 26px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nt-time b.struck { text-decoration: line-through; opacity: .7; }
  .nt-time .rel { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nt-line, .nt-meta { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; line-height: 20px; }
  .nt-line .dest { font-weight: 500; }
  .banner .plat { border-color: rgba(16,40,63,.35); height: 18px; font-size: 11px; }
  .banner.night .plat { border-color: rgba(255,255,255,.45); }
  .nt-time { align-items: center; gap: 8px; }
  .nt-time .hpill { flex: none; }
  .nt-meta .hpill { flex: 0 1 auto; }
  .nt-time .name { font-size: 16px; font-weight: 600; line-height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1000 auto; min-width: 0; }
  .nt-time .rel, .nt-meta .rel { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .nt-time .wide, .nt-time .narrow, .nt-meta .wide, .nt-meta .narrow, .nt-line .narrow { display: flex; align-items: center; min-width: 0; }
  .nt-meta .wide { gap: 6px; }
  .nt-time .narrow, .nt-meta .narrow, .nt-line .narrow { display: none; }
  .nt-line .narrow { flex: none; }
  .nt-time .wide { flex: none; }
  /* The status pill does not fit beside the time (or the station's name) with its whole label (measured by the card,
     see _fitPill): it goes to the last row, « in 8 min » to the time row. */
  .titles.below .nt-time .wide, .titles.below .nt-meta .wide { display: none; }
  .titles.below .nt-time .narrow, .titles.below .nt-meta .narrow, .titles.below .nt-line .narrow { display: flex; }
  @container tbcard (max-width: 200px) {
    .titles.below .nt-time .wide, .titles.below .nt-meta .wide { display: flex; }
    .titles.below .nt-time .narrow, .titles.below .nt-meta .narrow, .titles.below .nt-line .narrow { display: none; }
  }
  /* A narrow mini card: a smaller clock leaves its status pill whole. */
  @container tbcard (max-width: 260px) { .nt-time b { font-size: 18px; } .nt-time { gap: 6px; } }  .banner .type { background: rgba(255,255,255,.7); color: color-mix(in srgb, var(--c) 70%, #10283f); }
  .banner.night .type { background: rgba(10,20,40,.5); color: color-mix(in srgb, var(--c) 40%, #fff); }
  .next { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 2px; }
  .next .nt-time b { font-size: 20px; }
`;
