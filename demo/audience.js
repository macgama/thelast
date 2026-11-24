// The Last : mesure d'audience anonyme.
// Un identifiant tiré au hasard est gardé dans le navigateur (aucun lien avec le compte, le nom ou l'e-mail).
// On envoie : la page, la saison regardée, le candidat suivi et le temps passé (par tranches de 5 minutes,
// seulement quand la page est visible). Rien n'est envoyé si le site n'est pas relié à Supabase (démo).
(function () {
  "use strict";
  const cfg = window.THELAST_CONFIG || {};
  const on = !!(cfg.supabaseUrl && cfg.supabaseKey);
  const KEY = "thelast-visitor";
  let visitor = null;
  try {
    visitor = localStorage.getItem(KEY);
    if (!visitor) { visitor = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, "").slice(0, 32); localStorage.setItem(KEY, visitor); }
  } catch { visitor = null; } // navigation privée stricte : on ne compte pas
  const state = { page: null, season: 0, mode: "site", follow: null };
  const send = (minutes = 0) => {
    if (!on || !visitor || !state.page) return;
    const body = JSON.stringify({ p_season: state.season || 0, p_visitor: visitor, p_page: state.page, p_mode: state.mode, p_follow: state.follow, p_minutes: minutes });
    const headers = { apikey: cfg.supabaseKey, "content-type": "application/json" };
    if (!String(cfg.supabaseKey).startsWith("sb_")) headers.authorization = `Bearer ${cfg.supabaseKey}`;
    fetch(`${cfg.supabaseUrl}/rest/v1/rpc/track`, { method: "POST", headers, body, keepalive: true }).catch(() => {});
  };
  // temps passé : une impulsion toutes les 5 minutes de page visible
  let started = false;
  const pulse = () => { if (document.visibilityState === "visible") send(5); };
  const A = {
    enabled: on,
    /** Compte une visite de la page. opts : { season, mode: "live" | "replay" | "demo" | "site", follow } */
    page(name, opts = {}) {
      Object.assign(state, { page: name }, opts);
      send(0);
      if (!started) { started = true; setInterval(pulse, 5 * 60_000); }
    },
    /** Le spectateur suit un autre candidat. */
    follow(id) { if (id && id !== state.follow) { state.follow = id; send(-1); } },
  };
  window.TheLastAudience = A;
})();
