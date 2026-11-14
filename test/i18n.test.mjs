// Every language has every English text, with the same placeholders, and a plural form for every category its
// plural rules use.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./load.mjs";

const { TB_STRINGS } = load();
const en = TB_STRINGS.en;
const LANGS = ["en", "fr", "de", "es", "it", "nl", "pt", "pl", "sr", "sr-Latn", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];
const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, "");

test("the 22 languages of the other cards", () => {
  assert.deepEqual(Object.keys(TB_STRINGS).sort(), [...LANGS].sort());
});

test("every language has every text, with its placeholders, and nothing else", () => {
  const keys = Object.keys(en).filter((k) => base(k) === k);
  for (const lang of LANGS) {
    const t = TB_STRINGS[lang];
    for (const k of keys) {
      assert.ok(typeof t[k] === "string" && t[k].trim(), `${lang}.${k}`);
      assert.deepEqual(holes(t[k]), holes(en[k]), `${lang}.${k} placeholders`);
    }
    for (const k of Object.keys(t)) assert.ok(base(k) in en || `${base(k)}_other` in en, `${lang}.${k} is not an English key`);
  }
});

test("plural forms: one for every category of the language's rules, each with {n}", () => {
  for (const lang of LANGS) {
    const rules = new Intl.PluralRules(lang === "sr-Latn" ? "sr" : lang);
    const t = TB_STRINGS[lang];
    for (let n = 0; n <= 200; n++) {
      const form = rules.select(n);
      assert.ok(t[`trains_${form}`] ?? t.trains_other, `${lang} trains_${form}`);
    }
    for (const k of Object.keys(t).filter((x) => x.startsWith("trains_"))) assert.match(t[k], /\{n\}/, `${lang}.${k}`);
  }
});

test("the translations are not left in English (outside words that are the same)", () => {
  const same = new Set(["delay_min", "via", "integration", "operator", "messages", "show_platform", "platform", "trains_one", "trains_other"]);
  for (const lang of LANGS.filter((l) => l !== "en")) {
    const t = TB_STRINGS[lang];
    const copies = Object.keys(en).filter((k) => !same.has(k) && t[k] === en[k] && en[k].length > 6);
    assert.deepEqual(copies, [], lang);
  }
});
