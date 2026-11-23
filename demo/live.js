// The Last : le vrai direct. Comptes des spectateurs, données de la saison en cours, vote du soir et colis.
// Tout passe par Supabase (base de données en ligne). Sans réglage (config.js vide), le site reste la démo.
// Le navigateur ne reçoit que ce qui est déjà diffusé : la base refuse de montrer une heure avant son heure.
(function () {
  "use strict";
  const cfg = window.THELAST_CONFIG || {};
  const t = window.t || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));
  const lang = window.I18N?.lang || "fr";
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase?.createClient);
  const H = 3600_000;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);

  const L = {
    enabled, sb: null, user: null, profile: null, season: null, base: 0, D: null,
    rows: new Map(), lastPoll: 0, listeners: new Set(),
  };
  if (enabled) L.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });

  const ERR = {
    login_required: "Connecte-toi pour participer.",
    vote_closed: "Le vote est fermé pour l'instant.",
    not_threatened: "Ce candidat n'est pas menacé ce soir.",
    gift_used: "Tu as déjà envoyé ton colis du jour.",
    gift_closed: "Plus de colis possible : la saison se termine.",
    not_in_game: "Ce candidat n'est plus sur l'île.",
    no_season: "Aucune saison en cours.",
    "Invalid login credentials": "E-mail ou mot de passe incorrect.",
    "User already registered": "Un compte existe déjà avec cet e-mail. Connecte-toi.",
    "Password should be at least 6 characters.": "Le mot de passe doit faire au moins 6 caractères.",
    "Email not confirmed": "Confirme ton e-mail (regarde tes messages), puis connecte-toi.",
  };
  L.errText = (e) => {
    const m = String(e?.message || e || "");
    for (const [k, v] of Object.entries(ERR)) if (m.includes(k)) return t(v);
    if (/rate limit/i.test(m)) return t("Trop d'essais d'un coup. Réessaie dans quelques minutes.");
    if (/fetch|network/i.test(m)) return t("Pas de connexion au serveur. Vérifie ton réseau et réessaie.");
    return t("Oups, ça n'a pas marché : {m}", { m });
  };

  // ---------- compte ----------
  async function loadProfile() {
    L.profile = null;
    if (!L.user) return;
    const { data } = await L.sb.from("profiles").select("*").eq("id", L.user.id).maybeSingle();
    L.profile = data || null;
  }
  L.isSub = () => !!L.profile && L.profile.plan === "sub";
  L.isAdmin = () => !!L.profile && L.profile.role === "admin";
  L.onChange = (fn) => L.listeners.add(fn);
  const changed = () => L.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  L.signUp = async (email, password, pseudo) => {
    const { data, error } = await L.sb.auth.signUp({ email, password, options: { data: { pseudo, lang } } });
    if (error) throw error;
    if (!data.session) {
      // la base demande une confirmation par e-mail (réglage Supabase) : on essaie quand même de se connecter
      const r = await L.sb.auth.signInWithPassword({ email, password });
      if (r.error) throw r.error;
    }
  };
  L.signIn = async (email, password) => {
    const { error } = await L.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  L.signOut = async () => { await L.sb.auth.signOut(); };
  L.resetPassword = async (email) => {
    const { error } = await L.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, "") + "compte.html" });
    if (error) throw error;
  };
  L.setPseudo = async (pseudo) => {
    const { error } = await L.sb.from("profiles").update({ pseudo }).eq("id", L.user.id);
    if (error) throw error;
    await loadProfile(); changed();
  };
  L.saveLang = async (l) => { if (L.user) await L.sb.from("profiles").update({ lang: l }).eq("id", L.user.id); };

  L.init = async () => {
    if (!enabled) return L;
    const { data } = await L.sb.auth.getSession();
    L.user = data.session?.user || null;
    await loadProfile();
    L.sb.auth.onAuthStateChange(async (ev, session) => {
      const before = L.user?.id;
      L.user = session?.user || null;
      if (before === L.user?.id && ev !== "USER_UPDATED") return;
      await loadProfile();
      changed();
    });
    return L;
  };

  // ---------- saison ----------
  L.currentSeason = async () => {
    const { data, error } = await L.sb.from("seasons").select("id,name,show,seed,start_at,status,config,public,winner").neq("status", "draft").order("start_at", { ascending: true });
    if (error) throw error;
    const want = new URLSearchParams(location.search).get("saison");
    const list = (data || []).filter((s) => s.public || s.status !== "draft");
    return list.find((s) => String(s.id) === want) || list.find((s) => s.status === "live") || list.find((s) => s.status === "scheduled") || list.filter((s) => s.status === "done").pop() || null;
  };
  L.tickNow = () => Math.floor((Date.now() - L.base) / H);
  L.tickTime = (tk) => new Date(L.base + tk * H);

  // Recompose, à partir de ce qui est diffusé, le même objet que data.json pour la démo
  function emptyData(pub) {
    const D = JSON.parse(JSON.stringify(pub));
    D.live = true;
    D.events = []; D.snapshots = []; D.eliminations = []; D.winner = null;
    D.daily = {}; D.threats = {};
    for (const c of D.cast) { c.confessions = null; c.ai = true; c.secret = null; c.secretOpen = false; c.secretDay = null; }
    return D;
  }
  const byTick = (a, b) => a.t - b.t;
  function applyRow(D, r) {
    const p = r.payload;
    if (r.kind === "tick") {
      const tk = Number(r.key);
      D.events = D.events.filter((e) => e.t !== tk).concat(p.e).sort(byTick);
      const i = D.snapshots.findIndex(([x]) => x === tk);
      if (i >= 0) D.snapshots[i] = [tk, p.s]; else { D.snapshots.push([tk, p.s]); D.snapshots.sort((a, b) => a[0] - b[0]); }
    } else if (r.kind === "conf") {
      const c = D.cast.find((x) => x.id === p.id);
      if (c) { (c.confessions ??= {})[p.day] = (lang === "en" && p.en) || p.fr; }
    } else if (r.kind === "secret") {
      const c = D.cast.find((x) => x.id === p.id);
      if (c) { c.secret = (lang === "en" && p.en) || p.fr; c.secretOpen = true; }
    } else if (r.kind === "daily") D.daily[r.key] = p;
    else if (r.kind === "threat") D.threats[r.key] = p;
    else if (r.kind === "end") D.winner = p.winner;
  }
  function derive(D) {
    // les morceaux arrivent en plusieurs fois : on garde des tableaux triés et les données dérivées à jour
    const keep = [];
    for (let i = 0; i < D.snapshots.length; i++) if (i === 0 || D.snapshots[i][0] === D.snapshots[i - 1][0] + 1) keep.push(D.snapshots[i]); else break;
    D.snapshots.length = 0; D.snapshots.push(...keep);
    if (lang === "en") for (const e of D.events) if (e.en && !e._fr) { e._fr = e.fr; e.fr = e.en; }
    D.eliminations = D.events.filter((e) => e.type === "evacuated").map((e) => ({ id: e.a[0], t: e.t, day: Math.floor(e.t / 24) + 1, cause: e.d?.cause || null }));
  }

  L.load = async () => {
    const s = await L.currentSeason();
    if (!s || !s.public) return null;
    L.season = s;
    L.base = new Date(s.start_at).getTime() - 8 * H;
    const D = emptyData(s.public);
    if (lang === "en") {
      for (const c of D.cast) if (c.en) Object.assign(c, Object.fromEntries(Object.entries(c.en).filter(([, v]) => v)));
      D.arena.name = D.arena.en || D.arena.name;
      for (const z of D.arena.zones) if (z.en) z.name = z.en;
    }
    L.D = D;
    L.lastPoll = Date.now();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await L.sb.from("reveals").select("kind,key,reveal_at,payload,updated_at").eq("season_id", s.id).order("reveal_at").range(from, from + 999);
      if (error) throw error;
      for (const r of data) { L.rows.set(r.kind + "|" + r.key, r); applyRow(D, r); }
      if (data.length < 1000) break;
    }
    derive(D);
    return D;
  };

  /** Va chercher ce qui vient d'être diffusé. Renvoie le nombre de nouveaux morceaux. */
  L.refresh = async () => {
    if (!L.D) return 0;
    const since = new Date(L.lastPoll - 3 * 60_000).toISOString();
    const started = Date.now();
    const { data, error } = await L.sb.from("reveals").select("kind,key,reveal_at,payload,updated_at").eq("season_id", L.season.id)
      .or(`reveal_at.gt.${since},updated_at.gt.${since}`).order("reveal_at");
    if (error) throw error;
    let n = 0;
    for (const r of data) {
      const k = r.kind + "|" + r.key, old = L.rows.get(k);
      if (old && old.updated_at === r.updated_at) continue;
      L.rows.set(k, r); applyRow(L.D, r); n++;
    }
    L.lastPoll = started;
    if (n) derive(L.D);
    if (L.D.winner && L.season.status !== "done") L.season.status = "done";
    return n;
  };

  // ---------- vote et colis ----------
  L.dayNow = () => Math.floor(L.tickNow() / 24) + 1;
  L.voteWindow = (day) => {
    const c = L.D || {};
    return { opens: L.tickTime((day - 1) * 24 + (c.voteOpenHour ?? 16)), closes: L.tickTime((day - 1) * 24 + (c.voteHour ?? 19)) };
  };
  L.myVote = async (day) => {
    if (!L.user) return null;
    const { data } = await L.sb.from("votes").select("character_id").eq("season_id", L.season.id).eq("day", day).maybeSingle();
    return data?.character_id || null;
  };
  L.vote = async (id) => {
    const { data, error } = await L.sb.rpc("cast_vote", { p_season: L.season.id, p_character: id });
    if (error) throw error;
    return data;
  };
  L.voteCount = async (day) => {
    const { data } = await L.sb.rpc("vote_count", { p_season: L.season.id, p_day: day });
    return Number(data || 0);
  };
  L.results = async () => {
    const { data } = await L.sb.rpc("vote_results", { p_season: L.season.id });
    const out = {};
    for (const r of data || []) (out[r.day] ??= {})[r.character_id] = Number(r.votes);
    return out;
  };
  L.giftDay = () => { const tk = L.tickNow(); return Math.floor(tk / 24) + 1 + (tk % 24 >= 12 ? 1 : 0); };
  L.myGift = async () => {
    if (!L.user) return null;
    const { data } = await L.sb.from("gifts").select("character_id,item").eq("season_id", L.season.id).eq("gift_day", L.giftDay()).maybeSingle();
    return data || null;
  };
  L.gift = async (id, item) => {
    const { data, error } = await L.sb.rpc("send_gift", { p_season: L.season.id, p_character: id, p_item: item });
    if (error) throw error;
    return data;
  };

  // ---------- fenêtre de connexion ----------
  const CSS = `
  .auth{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:16px;background:color-mix(in srgb,#05080d 82%,transparent)}
  .auth>form{width:100%;max-width:400px;background:var(--deep,#0f1722);color:var(--sand,#f3e6cf);border:1px solid var(--line,#2a3442);border-radius:16px;padding:20px;display:grid;gap:12px;font:15px/1.4 var(--body,system-ui)}
  .auth h2{margin:0;font-family:var(--display,inherit);font-size:22px}
  .auth p{margin:0;color:var(--mist,#9aa7b5);font-size:14px}
  .auth label{display:grid;gap:4px;font-size:13px;color:var(--mist,#9aa7b5)}
  .auth input{font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#2a3442);background:var(--ink,#0a0f16);color:inherit;min-height:44px}
  .auth .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}
  .auth .tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .auth .tabs button,.auth .link{font:inherit;background:none;border:1px solid var(--line,#2a3442);color:inherit;border-radius:10px;padding:8px;cursor:pointer;min-height:40px}
  .auth .tabs button[aria-pressed=true]{background:var(--torch,#ff8a3d);color:#1a0f05;border-color:transparent;font-weight:700}
  .auth .link{border:0;padding:4px 0;text-decoration:underline;color:var(--mist,#9aa7b5);min-height:0}
  .auth .err{color:var(--danger,#ff5b6b);font-size:14px;min-height:1em}
  .auth .ok{color:var(--safe,#62d6a0);font-size:14px}
  .auth .go{font:inherit;font-weight:700;border:0;border-radius:12px;padding:12px;background:var(--torch,#ff8a3d);color:#1a0f05;cursor:pointer;min-height:46px}
  .auth .go[disabled]{opacity:.6}
  .auth .x{justify-self:end;background:none;border:0;color:inherit;font-size:24px;line-height:1;cursor:pointer;margin:-8px -6px -8px 0;min-width:40px;min-height:40px}`;
  let styled = false;
  /** Ouvre la fenêtre de connexion ou d'inscription. mode : "signup" ou "login". */
  L.openAuth = (mode = "signup", why = "") => new Promise((done) => {
    if (!enabled) return done(false);
    if (!styled) { const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); styled = true; }
    const box = document.createElement("div");
    box.className = "auth";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    const back = document.activeElement;
    const close = (ok) => { box.remove(); back?.focus?.(); done(ok); };
    const paint = () => {
      const up = mode === "signup", forgot = mode === "forgot";
      box.innerHTML = `<form novalidate>
        <button type="button" class="x" aria-label="${esc(t("Fermer"))}">×</button>
        <h2>${forgot ? esc(t("Mot de passe oublié")) : up ? esc(t("Rejoindre The Last")) : esc(t("Content de te revoir"))}</h2>
        ${why ? `<p>${esc(why)}</p>` : ""}
        ${forgot ? "" : `<div class="tabs"><button type="button" data-m="signup" aria-pressed="${up}">${esc(t("Créer un compte"))}</button><button type="button" data-m="login" aria-pressed="${!up}">${esc(t("Se connecter"))}</button></div>`}
        ${up ? `<label>${esc(t("Ton pseudo (visible des autres)"))}<input name="pseudo" autocomplete="nickname" required minlength="2" maxlength="24"></label>` : ""}
        <label>${esc(t("E-mail"))}<input name="email" type="email" autocomplete="email" required></label>
        ${forgot ? "" : `<label>${esc(t("Mot de passe (6 caractères minimum)"))}<input name="password" type="password" autocomplete="${up ? "new-password" : "current-password"}" required minlength="6"></label>`}
        <div class="err" role="alert"></div>
        <button class="go" type="submit">${forgot ? esc(t("Recevoir un lien")) : up ? esc(t("Créer mon compte, c'est gratuit")) : esc(t("Me connecter"))}</button>
        <div class="row">${mode === "login" ? `<button type="button" class="link" data-m="forgot">${esc(t("Mot de passe oublié ?"))}</button>` : forgot ? `<button type="button" class="link" data-m="login">${esc(t("Retour"))}</button>` : `<p>${esc(t("Un vote gratuit par jour, le même pour tout le monde. Rien à payer."))}</p>`}</div>
      </form>`;
      box.querySelector(".x").addEventListener("click", () => close(false));
      box.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.m; paint(); }));
      const f = box.querySelector("form"), err = box.querySelector(".err"), go = box.querySelector(".go");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        err.textContent = "";
        if (mode === "signup" && String(v.pseudo || "").trim().length < 2) return (err.textContent = t("Choisis un pseudo d'au moins 2 caractères."));
        if (!/^\S+@\S+\.\S+$/.test(String(v.email || ""))) return (err.textContent = t("Cet e-mail n'a pas l'air valide."));
        if (mode !== "forgot" && String(v.password || "").length < 6) return (err.textContent = t("Le mot de passe doit faire au moins 6 caractères."));
        go.disabled = true;
        try {
          if (mode === "signup") await L.signUp(String(v.email).trim(), String(v.password), String(v.pseudo).trim());
          else if (mode === "login") await L.signIn(String(v.email).trim(), String(v.password));
          else { await L.resetPassword(String(v.email).trim()); err.className = "ok"; err.textContent = t("Si un compte existe, un lien vient de partir par e-mail."); go.disabled = false; return; }
          close(true);
        } catch (ex) { err.textContent = L.errText(ex); go.disabled = false; }
      });
      box.querySelector("input")?.focus();
    };
    box.addEventListener("click", (e) => { if (e.target === box) close(false); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(false); });
    document.body.appendChild(box);
    paint();
  });

  // Bouton de compte à poser dans un en-tête : <button data-account></button>
  L.wireAccount = (root = document) => {
    const paint = () => root.querySelectorAll("[data-account]").forEach((b) => {
      b.hidden = !enabled;
      b.textContent = L.profile ? `👤 ${L.profile.pseudo}` : t("Se connecter");
      b.title = L.profile ? t("Ton compte") : t("Créer un compte ou se connecter");
    });
    root.querySelectorAll("[data-account]").forEach((b) => b.addEventListener("click", async () => {
      if (!L.profile) return L.openAuth("signup");
      menu(b);
    }));
    L.onChange(paint);
    paint();
  };
  function menu(anchor) {
    document.querySelector(".acctmenu")?.remove();
    const m = document.createElement("div");
    m.className = "acctmenu";
    m.style.cssText = "position:fixed;z-index:41;right:12px;top:56px;max-width:min(320px,calc(100vw - 24px));background:var(--deep,#0f1722);color:var(--sand,#f3e6cf);border:1px solid var(--line,#2a3442);border-radius:14px;padding:14px;display:grid;gap:8px;font:14px var(--body,system-ui);box-shadow:0 12px 40px #0008";
    const btn = "font:inherit;text-align:left;background:none;border:1px solid var(--line,#2a3442);color:inherit;border-radius:10px;padding:10px;cursor:pointer;min-height:44px";
    m.innerHTML = `<b>${esc(L.profile.pseudo)}</b><small style="color:var(--mist,#9aa7b5)">${esc(L.user?.email || "")} · ${L.profile.plan === "sub" ? esc(t("accès complet au direct")) : esc(t("formule gratuite : Quotidienne et vote"))}</small>
      <button type="button" data-a="pseudo" style="${btn}">✏️ ${esc(t("Changer de pseudo"))}</button>
      ${L.isAdmin() ? `<a href="admin.html" style="${btn};text-decoration:none">🛠️ ${esc(t("Back-office"))}</a>` : ""}
      <button type="button" data-a="out" style="${btn}">🚪 ${esc(t("Se déconnecter"))}</button>`;
    document.body.appendChild(m);
    const off = (e) => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener("click", off, true); } };
    setTimeout(() => document.addEventListener("click", off, true));
    m.querySelector('[data-a="out"]').addEventListener("click", async () => { m.remove(); await L.signOut(); });
    m.querySelector('[data-a="pseudo"]').addEventListener("click", async () => {
      const p = prompt(t("Ton nouveau pseudo (2 à 24 caractères)"), L.profile.pseudo);
      if (p && p.trim().length >= 2) { try { await L.setPseudo(p.trim().slice(0, 24)); } catch (e) { alert(L.errText(e)); } }
      m.remove();
    });
  }

  window.TheLastLive = L;
})();
