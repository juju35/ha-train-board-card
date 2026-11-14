// The brand logos embedded in the bundle, as data URIs: every images/<slug>.svg or images/<slug>.png that exists
// (no network at run time). A brand whose file is missing simply gets no badge.
import { existsSync, readFileSync } from "node:fs";

// The marker in src/cards.js replaced by the logos.
export const MARKER = "{} /* __BRAND_LOGOS__ */";

export const brandLogos = (root) => {
  const code = readFileSync(`${root}src/adapters.js`, "utf8");
  const slugs = [...new Set([...code.matchAll(/\bbrand: "([a-z0-9-]+)"/g)].map((m) => m[1]))];
  const out = {};
  for (const slug of [...slugs, "obb"]) {
    const svg = `${root}images/${slug}.svg`;
    const png = `${root}images/${slug}.png`;
    if (existsSync(svg)) out[slug] = `data:image/svg+xml,${encodeURIComponent(readFileSync(svg, "utf8").trim())}`;
    else if (existsSync(png)) out[slug] = `data:image/png;base64,${readFileSync(png).toString("base64")}`;
  }
  return out;
};

export const withLogos = (code, root) => code.replace(MARKER, JSON.stringify(brandLogos(root)));
