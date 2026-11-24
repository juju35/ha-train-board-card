// Times written « HH:MM » are read in the local time zone: the tests run in UTC, like the fixtures.
process.env.TZ = "UTC";
// Evaluates the sources in a sandbox, concatenated as scripts/build.mjs does, with minimal DOM stand-ins, and
// returns the names the tests need. No dependency, no browser: the shadow root is a plain object whose innerHTML
// the tests read.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { withLogos } from "../scripts/brand-logos.mjs";
import { SOURCES } from "../scripts/sources.mjs";
import { sources } from "./source.mjs";

const root = new URL("../", import.meta.url).pathname;
const read = (name) => withLogos((sources[`${name}.js`] ?? readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8")), root);

export const load = ({ now } = {}) => {
  const registry = new Map();
  const docListeners = {};
  class HTMLElement {
    attachShadow() {
      this.shadowRoot = {
        innerHTML: "",
        listeners: {},
        addEventListener(type, fn) {
          (this.listeners[type] ??= []).push(fn);
        },
        querySelector() {
          return null;
        },
      };
      return this.shadowRoot;
    }
    dispatchEvent(ev) {
      (this.events ??= []).push(ev);
    }
    appendChild(el) {
      (this.children ??= []).push(el);
    }
  }
  const RealDate = Date;
  // A fixed clock when asked: Date.now() and new Date() (no argument) read it.
  const FixedDate = now
    ? class extends RealDate {
        constructor(...a) {
          super(...(a.length ? a : [now]));
        }
        static now() {
          return now;
        }
      }
    : RealDate;
  const winListeners = {};
  const sandbox = {
    HTMLElement,
    Date: FixedDate,
    Intl,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    console: { info() {}, error() {}, log() {}, warn() {} },
    customElements: { get: (t) => registry.get(t), define: (t, c) => registry.set(t, c) },
    document: {
      // Other elements (ha-form) keep their listeners, for the tests to call.
      createElement: (t) =>
        registry.has(t)
          ? new (registry.get(t))()
          : {
              tag: t,
              listeners: {},
              addEventListener(type, fn) {
                this.listeners[type] = fn;
              },
            },
      addEventListener(type, fn) {
        (docListeners[type] ??= new Set()).add(fn);
      },
      removeEventListener(type, fn) {
        docListeners[type]?.delete(fn);
      },
    },
    setInterval: () => 1,
    clearInterval() {},
    docListeners,
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type, fn) => (winListeners[type] ??= new Set()).add(fn);
  sandbox.removeEventListener = (type, fn) => winListeners[type]?.delete(fn);
  sandbox.fire = (type, ev) => {
    for (const fn of winListeners[type] || []) fn(ev);
  };
  // Each source runs as its own script, named after its file (top-level declarations are shared between the scripts
  // of one context, as in the block of the bundle), so that --experimental-test-coverage reports src/*.js.
  vm.createContext(sandbox);
  for (const name of SOURCES) vm.runInContext(read(name), sandbox, { filename: `${root}src/${name}.js` });
  const code = `globalThis.__tb = { TB_STRINGS, TB_ADAPTERS, tbRead, tbBoard, tbStatus, tbBoardStatus, tbTime, tbSplitTrain, tbFamily, tbColor, tbIsNight,
    tbPlural, tbClock, tbCandidates, tbAdapterFor, tbFilter, tbOnTime, tbSceneSvg, TB_DEFAULTS };`;
  vm.runInContext(code, sandbox);
  return { ...sandbox.__tb, registry, sandbox, cards: { full: registry.get("train-board-card"), mini: registry.get("train-board-mini-card") } };
};
