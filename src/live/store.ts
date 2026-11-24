// Accès à la base Supabase depuis le moteur (GitHub Actions), avec la clé secrète du projet.
// Cette clé passe outre les règles de sécurité : elle ne sort jamais du moteur (secret GitHub), jamais dans le site.
export interface SeasonRow {
  id: number; name: string; show: string; seed: number; start_at: string; status: string;
  config: Record<string, unknown>; public: unknown; winner: string | null; engine: Record<string, unknown> | null;
}
export interface PrivateRow { season_id: number; pool: unknown; catalog: unknown; looks: unknown; ai: unknown }

export class Rest {
  constructor(private url: string, private key: string) {
    this.url = url.replace(/\/+$/, "");
  }
  private headers(extra: Record<string, string> = {}) {
    // Nouvelles clés « sb_secret_… » : seulement dans apikey. Anciennes clés (JWT) : aussi en Authorization.
    const h: Record<string, string> = { apikey: this.key, "content-type": "application/json", ...extra };
    if (!this.key.startsWith("sb_")) h.authorization = `Bearer ${this.key}`;
    return h;
  }
  async req<T = any>(method: string, path: string, body?: unknown, prefer?: string): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`${this.url}/rest/v1/${path}`, {
          method, headers: this.headers(prefer ? { prefer } : {}), body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });
        const text = await res.text();
        if (!res.ok) {
          const err = new Error(`Supabase ${method} ${path.split("?")[0]} : ${res.status} ${text.slice(0, 300)}`);
          if (res.status < 500) throw Object.assign(err, { final: true });
          throw err;
        }
        return (text ? JSON.parse(text) : null) as T;
      } catch (e: any) {
        last = e;
        if (e?.final) throw e;
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      }
    }
    throw last;
  }
  get<T = any>(path: string) { return this.req<T>("GET", path); }
  /** Lit une table entière, par pages de 1000 lignes. */
  async all<T = any>(path: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await this.get<T[]>(`${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${from}`);
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }
  upsert(table: string, rows: unknown[], onConflict: string) {
    return this.req("POST", `${table}?on_conflict=${onConflict}`, rows, "resolution=merge-duplicates,return=minimal");
  }
  patch(path: string, body: unknown) { return this.req("PATCH", path, body, "return=minimal"); }
}

export class LiveStore {
  constructor(readonly db: Rest) {}

  /** La saison à faire avancer : celle en cours, sinon la prochaine programmée. */
  async currentSeason(): Promise<SeasonRow | null> {
    const live = await this.db.get<SeasonRow[]>("seasons?status=eq.live&order=start_at.asc&limit=1");
    if (live[0]) return live[0];
    const next = await this.db.get<SeasonRow[]>("seasons?status=eq.scheduled&order=start_at.asc&limit=1");
    return next[0] ?? null;
  }
  updateSeason(id: number, patch: Partial<SeasonRow>) {
    return this.db.patch(`seasons?id=eq.${id}`, { ...patch, updated_at: new Date().toISOString() });
  }
  async getPrivate(id: number): Promise<PrivateRow | null> {
    return (await this.db.get<PrivateRow[]>(`season_private?season_id=eq.${id}`))[0] ?? null;
  }
  putPrivate(id: number, patch: Partial<PrivateRow>) {
    return this.db.upsert("season_private", [{ season_id: id, ...patch, updated_at: new Date().toISOString() }], "season_id");
  }
  characters() { return this.db.all<{ id: string; data: any; look: any; photo: string | null; active: boolean }>("characters?select=*&order=id"); }
  catastrophes() { return this.db.all<{ id: string; kind: string; data: any; active: boolean; sort: number }>("catastrophes?select=*&order=sort,id"); }
  async setting<T>(key: string): Promise<T | null> {
    return (await this.db.get<{ value: T }[]>(`settings?key=eq.${encodeURIComponent(key)}`))[0]?.value ?? null;
  }
  votes(season: number) { return this.db.all<{ day: number; character_id: string }>(`votes?select=day,character_id&season_id=eq.${season}`); }
  gifts(season: number) { return this.db.all<{ gift_day: number; character_id: string; item: string }>(`gifts?select=gift_day,character_id,item&season_id=eq.${season}`); }
  revealHashes(season: number) { return this.db.all<{ kind: string; key: string; hash: string }>(`reveals?select=kind,key,hash&season_id=eq.${season}`); }
  async upsertReveals(season: number, rows: { kind: string; key: string; reveal_at: string; payload: unknown; hash: string }[]) {
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 40) {
      await this.db.upsert("reveals", rows.slice(i, i + 40).map((r) => ({ season_id: season, ...r, updated_at: now })), "season_id,kind,key");
    }
  }
}
