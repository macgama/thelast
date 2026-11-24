// Banc d'essai : une imitation locale de Supabase (API REST façon PostgREST, comptes façon GoTrue, stockage),
// branchée sur un vrai Postgres où l'on a chargé supabase/schema.sql. Sert seulement aux tests :
// les règles de sécurité (RLS), les fonctions de vote et de colis sont celles de la vraie base.
// Usage : tsx tests/supabase/mini-supabase.ts [port=54321]  (sert aussi le dossier demo/ à la racine)
import { createHmac, randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import pg from "pg";
pg.types.setTypeParser(20, (v) => Number(v)); // bigint en nombre, comme PostgREST

export const ANON_KEY = "anon-test-key";
export const SERVICE_KEY = "service-test-key";
const SECRET = "test-jwt-secret";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(claims: Record<string, unknown>) {
  const head = b64({ alg: "HS256", typ: "JWT" }), body = b64(claims);
  return `${head}.${body}.${createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
function verify(tok: string): Record<string, any> | null {
  const [h, b, s] = tok.split(".");
  if (!s || createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url") !== s) return null;
  const c = JSON.parse(Buffer.from(b, "base64url").toString());
  return c.exp && c.exp * 1000 < Date.now() ? null : c;
}

const OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };
const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`nom invalide ${s}`);
  return `"${s}"`;
};

function filterSql(col: string, expr: string, params: unknown[]): string {
  let not = false;
  if (expr.startsWith("not.")) { not = true; expr = expr.slice(4); }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot), val = expr.slice(dot + 1);
  let sql: string;
  if (op === "in") {
    const list = val.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
    params.push(list); sql = `${ident(col)}::text = any($${params.length}::text[])`;
  } else if (op === "is") sql = `${ident(col)} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`;
  else if (OPS[op]) { params.push(val); sql = `${ident(col)} ${OPS[op]} $${params.length}`; }
  else throw new Error(`opérateur ${op}`);
  return not ? `not (${sql})` : sql;
}

function whereOf(q: URLSearchParams, params: unknown[]) {
  const parts: string[] = [];
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or") {
      const inner = v.replace(/^\(|\)$/g, "").split(",").map((p) => { const i = p.indexOf("."); return filterSql(p.slice(0, i), p.slice(i + 1), params); });
      parts.push(`(${inner.join(" or ")})`);
    } else parts.push(filterSql(k, v, params));
  }
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

const orderOf = (q: URLSearchParams) => {
  const o = q.get("order");
  if (!o) return "";
  return " order by " + o.split(",").map((p) => { const [c, ...m] = p.split("."); return `${ident(c)}${m.includes("desc") ? " desc" : ""}${m.includes("nullslast") ? " nulls last" : m.includes("nullsfirst") ? " nulls first" : ""}`; }).join(", ");
};

async function body(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const s = Buffer.concat(chunks).toString();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

export interface Mini { url: string; close(): Promise<void>; pool: pg.Pool; files: Map<string, Buffer> }

export async function startMini(port = 54321, database = "thelast", root = "demo"): Promise<Mini> {
  const pool = new pg.Pool({ database, user: "postgres", password: process.env.PGPASSWORD ?? "postgres", host: "127.0.0.1" });
  const files = new Map<string, Buffer>();

  async function asRole<T>(role: string, sub: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
  }

  function who(req: IncomingMessage): { role: string; sub: string | null } {
    const key = String(req.headers.apikey ?? "");
    const auth = String(req.headers.authorization ?? "").replace(/^Bearer /i, "");
    if (key === SERVICE_KEY || auth === SERVICE_KEY) return { role: "service_role", sub: null };
    const c = auth && auth !== ANON_KEY ? verify(auth) : null;
    if (c?.sub) return { role: "authenticated", sub: c.sub };
    return { role: "anon", sub: null };
  }

  const send = (res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers });
    res.end(data === undefined ? "" : JSON.stringify(data));
  };

  function session(u: { id: string; email: string; raw_user_meta_data: any; created_at: string }) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, user_metadata: u.raw_user_meta_data ?? {}, app_metadata: { provider: "email" }, created_at: u.created_at };
    return { access_token: sign({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, exp }), token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `r-${u.id}`, user };
  }

  async function authRoute(req: IncomingMessage, res: ServerResponse, url: URL) {
    const p = url.pathname.replace("/auth/v1", "");
    const b = await body(req);
    if (p === "/signup") {
      const exists = await pool.query("select 1 from auth.users where email = $1", [b.email]);
      if (exists.rowCount) return send(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      if (!b.password || b.password.length < 6) return send(res, 422, { code: 422, error_code: "weak_password", msg: "Password should be at least 6 characters." });
      const u = (await pool.query("insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning *", [b.email, b.password, b.data ?? {}])).rows[0];
      return send(res, 200, session(u));
    }
    if (p === "/token") {
      const g = url.searchParams.get("grant_type");
      let u: any;
      if (g === "password") u = (await pool.query("select * from auth.users where email = $1 and encrypted_password = $2", [b.email, b.password])).rows[0];
      if (g === "refresh_token") u = (await pool.query("select * from auth.users where id::text = $1", [String(b.refresh_token).replace(/^r-/, "")])).rows[0];
      if (!u) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(res, 200, session(u));
    }
    if (p === "/user") {
      const c = verify(String(req.headers.authorization ?? "").replace(/^Bearer /i, ""));
      if (!c) return send(res, 401, { msg: "invalid JWT" });
      if (req.method === "PUT" && b?.password) await pool.query("update auth.users set encrypted_password = $2 where id = $1", [c.sub, b.password]);
      const u = (await pool.query("select * from auth.users where id = $1", [c.sub])).rows[0];
      return send(res, 200, session(u).user);
    }
    if (p === "/logout") return send(res, 204, undefined);
    if (p === "/recover") return send(res, 200, {});
    if (p === "/settings") return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
    return send(res, 404, { msg: "not found" });
  }

  async function restRoute(req: IncomingMessage, res: ServerResponse, url: URL) {
    const { role, sub } = who(req);
    const path = url.pathname.replace("/rest/v1/", "");
    const q = url.searchParams;
    const prefer = String(req.headers.prefer ?? "");
    const single = String(req.headers.accept ?? "").includes("vnd.pgrst.object");
    const b = req.method === "GET" || req.method === "HEAD" ? null : await body(req);
    try {
      const out = await asRole(role, sub, async (c) => {
        if (path.startsWith("rpc/")) {
          const fn = path.slice(4);
          const args = { ...(b ?? {}), ...Object.fromEntries([...q].filter(([k]) => !["select", "order", "limit"].includes(k))) };
          const meta = (await c.query("select proretset, prorettype::regtype::text t from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace", [fn])).rows[0];
          const names = Object.keys(args);
          const call = `public.${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(", ")})`;
          const vals = names.map((n) => (typeof args[n] === "object" && args[n] !== null ? JSON.stringify(args[n]) : args[n]));
          if (meta?.proretset || meta?.t === "record") return (await c.query(`select * from ${call}`, vals)).rows;
          const r = (await c.query(`select ${call} as v`, vals)).rows[0]?.v;
          return meta?.t === "void" ? null : r;
        }
        const t = `public.${ident(path)}`;
        const params: unknown[] = [];
        if (req.method === "GET") {
          const sel = q.get("select") && q.get("select") !== "*" ? q.get("select")!.split(",").map(ident).join(", ") : "*";
          let sql = `select ${sel} from ${t}${whereOf(q, params)}${orderOf(q)}`;
          if (q.get("limit")) sql += ` limit ${Number(q.get("limit"))}`;
          if (q.get("offset")) sql += ` offset ${Number(q.get("offset"))}`;
          return (await c.query(sql, params)).rows;
        }
        const ret = prefer.includes("return=representation") ? " returning *" : "";
        if (req.method === "POST") {
          const rows = Array.isArray(b) ? b : [b];
          const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
          params.push(JSON.stringify(rows));
          let sql = `insert into ${t} (${cols.map(ident).join(", ")}) select ${cols.map(ident).join(", ")} from json_populate_recordset(null::${t}, $1)`;
          const oc = q.get("on_conflict");
          if (oc) {
            const keys = oc.split(",");
            const upd = cols.filter((x) => !keys.includes(x));
            sql += prefer.includes("ignore-duplicates") || !upd.length ? ` on conflict (${keys.map(ident).join(", ")}) do nothing` : ` on conflict (${keys.map(ident).join(", ")}) do update set ${upd.map((x) => `${ident(x)} = excluded.${ident(x)}`).join(", ")}`;
          }
          return (await c.query(sql + ret, params)).rows;
        }
        if (req.method === "PATCH") {
          const cols = Object.keys(b);
          params.push(JSON.stringify(b));
          const sql = `update ${t} set ${cols.map((x) => `${ident(x)} = r.${ident(x)}`).join(", ")} from json_populate_record(null::${t}, $1) r${whereOf(q, params).replace(/"(\w+)"/g, `${t}."$1"`)}`;
          return (await c.query(sql + ret.replace("*", `${t}.*`), params)).rows;
        }
        if (req.method === "DELETE") return (await c.query(`delete from ${t}${whereOf(q, params)}${ret}`, params)).rows;
        throw new Error("méthode");
      });
      if (single) { const arr = Array.isArray(out) ? out : [out]; if (arr.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }); return send(res, 200, arr[0]); }
      if (!path.startsWith("rpc/") && req.method !== "GET" && !prefer.includes("return=representation")) return send(res, 201, undefined);
      return send(res, 200, out);
    } catch (e: any) {
      return send(res, e.code === "42501" ? 403 : 400, { code: e.code ?? "PGRST", message: e.message, details: null, hint: null });
    }
  }

  async function storageRoute(req: IncomingMessage, res: ServerResponse, url: URL) {
    const m = /^\/storage\/v1\/object\/(public\/)?(.+)$/.exec(url.pathname);
    if (!m) return send(res, 404, {});
    if (req.method === "GET") { const f = files.get(m[2]); if (!f) return send(res, 404, {}); res.writeHead(200, { "content-type": "image/webp" }); return res.end(f); }
    const chunks: Buffer[] = [];
    for await (const ch of req) chunks.push(ch as Buffer);
    if (who(req).role !== "authenticated") return send(res, 403, { message: "forbidden" });
    files.set(m[2], Buffer.concat(chunks));
    return send(res, 200, { Key: m[2] });
  }

  const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".css": "text/css", ".svg": "image/svg+xml" };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); return res.end(); }
    try {
      if (url.pathname.startsWith("/auth/v1/")) return await authRoute(req, res, url);
      if (url.pathname.startsWith("/rest/v1/")) return await restRoute(req, res, url);
      if (url.pathname.startsWith("/storage/v1/")) return await storageRoute(req, res, url);
      if (url.pathname === "/config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(`window.THELAST_CONFIG = { supabaseUrl: ${JSON.stringify(`http://localhost:${port}`)}, supabaseKey: ${JSON.stringify(ANON_KEY)} };`); }
      let f = normalize(join(root, decodeURIComponent(url.pathname)));
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
      if (!f.startsWith(normalize(root)) || !existsSync(f)) { res.writeHead(404); return res.end("absent"); }
      res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
      createReadStream(f).pipe(res);
    } catch (e: any) { send(res, 500, { message: e.message }); }
  });
  await new Promise<void>((r) => server.listen(port, r));
  return { url: `http://localhost:${port}`, pool, files, close: async () => { await new Promise((r) => server.close(r)); await pool.end(); } };
}

if (process.argv[1]?.endsWith("mini-supabase.ts")) {
  const port = Number(process.argv[2] ?? 54321);
  startMini(port, process.env.PGDATABASE ?? "thelast", process.env.SITE_ROOT ?? "demo").then((m) => console.log(`Mini Supabase sur ${m.url} (clé publique ${ANON_KEY}, clé secrète ${SERVICE_KEY})`));
}
void randomUUID;
