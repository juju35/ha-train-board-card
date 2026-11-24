// The brand logos embedded in the bundle, as data URIs: for each brand, images/<slug>-mark.svg (the emblem alone,
// cut from a wide logotype for the small badge), else images/<slug>.svg, else images/<slug>.png — the first that
// exists (no network at run time). A brand without any file simply gets no badge.
import { existsSync, readFileSync } from "node:fs";

// The marker in the bundled card source (test/source.mjs) replaced by the logos.
export const MARKER = "{} /* __BRAND_LOGOS__ */";

export const brandLogos = (root) => {
  const code = readFileSync(`${root}src/adapters.js`, "utf8");
  const slugs = [...new Set([...code.matchAll(/\bbrand: "([a-z0-9-]+)"/g)].map((m) => m[1]))];
  const out = {};
  for (const slug of [...slugs, "obb"]) {
    const mark = `${root}images/${slug}-mark.svg`;
    const svg = `${root}images/${slug}.svg`;
    const png = `${root}images/${slug}.png`;
    if (existsSync(mark)) out[slug] = `data:image/svg+xml,${encodeURIComponent(readFileSync(mark, "utf8").trim())}`;
    else if (existsSync(svg)) out[slug] = `data:image/svg+xml,${encodeURIComponent(readFileSync(svg, "utf8").trim())}`;
    else if (existsSync(png)) out[slug] = `data:image/png;base64,${readFileSync(png).toString("base64")}`;
  }
  return out;
};

export const withLogos = (code, root) => code.replace(MARKER, JSON.stringify(brandLogos(root)));
