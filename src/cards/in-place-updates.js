// ---------------------------------------------------------------------------
// In-place updates of the shadow DOM (kept nodes keep focus, hover and their running animations).
// ---------------------------------------------------------------------------

export const tbPatchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
export const tbKeyOf = (n) => (n.nodeType === 1 ? n.getAttribute("data-key") : null);
export const tbSameNode = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
export const tbPatchChildren = (cur, next) => {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = tbKeyOf(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = tbKeyOf(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!tbSameNode(o, n) || used.has(o) || (k === null && tbKeyOf(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (!o) {
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    if (o !== ref) cur.insertBefore(o, ref);
    if (n.nodeType === 1) {
      tbPatchAttrs(o, n);
      tbPatchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
// The width of an element's whole text in fractional pixels, even while an ellipsis cuts it.
export const tbTextWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width || el.scrollWidth;
};

export const tbMorph = (root, html) => {
  if (typeof document === "undefined" || !document.createElement("template").content) {
    root.innerHTML = html;
    return;
  }
  const tpl = document.createElement("template");
  // SVG elements need their namespace: parsed as HTML inside a template, <svg> children get it.
  tpl.innerHTML = html;
  tbPatchChildren(root, tpl.content);
};

// A value inside a CSS attribute selector (a train key may hold a quote or a backslash).
export const tbCssEsc = (v) => (globalThis.CSS?.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&"));

// A click inside a dialog opened from the card (more-info…) is not a click outside the card.
export const tbInDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// « A click elsewhere », caught on the pointer (iOS sends no click for a tap on something not clickable): the
// press and the release both outside the card. Keyboard clicks (no click count) go through the click event.
export const tbWatchOutside = (card, handler) => {
  let downOutside = false;
  const outside = (ev) => !ev.composedPath().includes(card);
  const onDown = (ev) => {
    downOutside = outside(ev);
  };
  const onUp = (ev) => {
    if (downOutside && outside(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && outside(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
  };
};
