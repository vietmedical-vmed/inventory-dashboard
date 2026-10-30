// ════════════════════════════════════════════════════════════════════════
// inventory-api — cổng đọc dữ liệu cho dashboard báo cáo tồn kho.
//
//   POST /functions/v1/inventory-api
//   headers: apikey, x-portal-token: <vmed_token>  (token của sale_target-login, dùng chung với portal)
//   body   : { fn, args }
//
//   fn = một RPC đọc trong schema app_inventory (xem RPC_DOC) → { ok, data }
//   fn = 'lam_moi'  → { ok, token, expiresAt }  cấp lại token 2h (thông tin đọc lại từ shared.users)
//
//   Anon không gọi RPC trực tiếp được nữa (migration 20261030000006): mọi lần đọc phải có token
//   hợp lệ và tài khoản còn active trong shared.users.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_SECRET (dùng chung với sale_target-login).
// Deploy : supabase functions deploy inventory-api --no-verify-jwt --project-ref nrfxymnfmjhbsgpipvkb
// ════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RPC_DOC = new Set([
  "ds_snapshot", "ds_khoi", "ds_thang", "ds_ten_hien_thi", "ds_ton_kho_ky",
  "bao_cao", "thong_tin_snapshot", "chi_tiet", "kiem_tra",
]);
// Role được xem báo cáo; rỗng = mọi tài khoản đang active.
const ROLE_DUOC_XEM: string[] = [];
const TOKEN_TTL_SEC = 2 * 60 * 60;

const ALLOWED_ORIGINS = ["https://vietmedical-vmed.github.io"];
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) || LOCALHOST_RE.test(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const secret = Deno.env.get("TOKEN_SECRET");
  if (!secret) return json({ ok: false, error: "config_error" }, 500);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { throw new HttpError(400, "bad_body"); }

    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const user = await requireUser(db, req.headers.get("x-portal-token") ?? "", secret);
    const fn = String(body.fn ?? "");

    if (fn === "lam_moi") {
      const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
      const token = await signToken({
        username: user.username,
        ho_ten: user.ho_va_ten || user.username,
        role: String(user.role || "").toLowerCase(),
        mien: user.mien || "MB",
        bu: user.bu ?? "",
        scope: user.scope ?? "",
        nhom_san_pham: user.nhom_san_pham ?? "",
        exp,
      }, secret);
      return json({ ok: true, token, expiresAt: exp });
    }

    if (!RPC_DOC.has(fn)) throw new HttpError(400, "unknown_fn");
    const args = body.args && typeof body.args === "object" ? body.args as Record<string, unknown> : {};
    const { data, error } = await db.schema("app_inventory").rpc(fn, args);
    if (error) throw new HttpError(400, "rpc_error", error.message);
    return json({ ok: true, data });
  } catch (e) {
    if (e instanceof HttpError) return json({ ok: false, error: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ ok: false, error: "server_error", message: String((e as Error)?.message || e) }, 500);
  }
});

// ---------- Auth ----------
// Không tin role trong token: đọc lại shared.users để chắc tài khoản còn active.
interface User {
  username: string; role: string; scope: string; bu: string; mien: string;
  nhom_san_pham: string; ho_va_ten: string; active: boolean;
}

async function requireUser(db: SupabaseClient, token: string, secret: string): Promise<User> {
  const username = await verifyToken(token, secret);
  if (!username) throw new HttpError(401, "token_expired", "Phiên đăng nhập đã hết hạn");
  const { data, error } = await db.schema("shared").from("users")
    .select("username, role, scope, bu, mien, nhom_san_pham, ho_va_ten, active")
    .eq("username", username).maybeSingle();
  if (error) throw error;
  if (!data || data.active === false) throw new HttpError(403, "forbidden", "Tài khoản không tồn tại hoặc đã bị khoá");
  const role = String(data.role ?? "").trim().toLowerCase();
  if (ROLE_DUOC_XEM.length && !ROLE_DUOC_XEM.includes(role)) {
    throw new HttpError(403, "forbidden", "Tài khoản không có quyền xem báo cáo tồn kho");
  }
  return data as User;
}

// Token chuẩn chung: base64url(JSON payload).base64url(hmacSHA256(payload, TOKEN_SECRET))
const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

async function signToken(payload: Record<string, unknown>, secret: string) {
  const p = b64url(enc.encode(JSON.stringify(payload)));
  return `${p}.${b64url(await hmac(secret, p))}`;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
  const [p, sig] = String(token).split(".");
  if (!p || !sig) return null;
  if (!timingSafeEqual(sig, b64url(await hmac(secret, p)))) return null;
  try {
    const bin = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
    return (payload.username ?? payload.u ?? null) as string | null;
  } catch {
    return null;
  }
}
