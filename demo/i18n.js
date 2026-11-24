// The Last : langue de l'interface (français ou anglais).
// Dans le code, chaque texte est écrit en français et passe par t("…") : le français sert de clé,
// la traduction anglaise est dans i18n-en.js. Un texte sans traduction reste en français (rien ne casse).
// Dans le HTML : data-i18n sur un élément traduit son texte ; data-i18n-attr="title,aria-label" traduit ces attributs.
(function () {
  "use strict";
  const KEY = "thelast-lang";
  const pick = () => {
    try {
      const q = new URLSearchParams(location.search).get("lang");
      if (q === "fr" || q === "en") { localStorage.setItem(KEY, q); return q; }
      const s = localStorage.getItem(KEY);
      if (s === "fr" || s === "en") return s;
    } catch {}
    return /^fr\b/i.test(navigator.language || "fr") ? "fr" : "en";
  };
  const lang = pick();
  const EN = {};
  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);
  function t(fr, vars) {
    return fill(lang === "en" && EN[fr] !== undefined ? EN[fr] : fr, vars);
  }
  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.dataset.i18nKey || (el.dataset.i18nKey = el.dataset.i18n || el.innerHTML.trim());
      if (lang === "en" && EN[k] !== undefined) el.innerHTML = EN[k];
    });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      for (const a of el.dataset.i18nAttr.split(",")) {
        const v = el.getAttribute(a.trim());
        if (v && lang === "en" && EN[v] !== undefined) el.setAttribute(a.trim(), EN[v]);
      }
    });
  }
  function set(l) {
    try { localStorage.setItem(KEY, l); } catch {}
    const u = new URL(location.href);
    u.searchParams.delete("lang");
    location.href = u.toString();
  }
  // Petit bouton FR / EN à poser n'importe où : <button data-lang-switch></button>
  function wire(root = document) {
    root.querySelectorAll("[data-lang-switch]").forEach((b) => {
      b.textContent = lang === "fr" ? "EN" : "FR";
      b.title = lang === "fr" ? "English version" : "Version française";
      b.setAttribute("aria-label", b.title);
      b.setAttribute("lang", lang === "fr" ? "en" : "fr");
      b.addEventListener("click", () => {
        set(lang === "fr" ? "en" : "fr");
        window.TheLastLive?.saveLang?.(lang === "fr" ? "en" : "fr");
      });
    });
  }
  document.documentElement.lang = lang;
  window.I18N = { lang, t, apply, set, wire, add: (d) => Object.assign(EN, d), missing: (keys) => keys.filter((k) => EN[k] === undefined) };
  window.t = t;
  document.addEventListener("DOMContentLoaded", () => { apply(); wire(); });
})();
