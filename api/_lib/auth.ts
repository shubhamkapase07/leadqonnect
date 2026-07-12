/// <reference types="node" />
// Auth primitives — password hashing (Node scrypt, no native deps), JWT sessions (jose),
// and request helpers. Replaces Firebase Auth. Tokens are signed JWTs the client stores
// and sends as `Authorization: Bearer <token>`.
import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { db, nowSec } from "./turso.js";

const JWT_TTL_DAYS = 30;

// Bootstrap admin — mirrors the app's hardcoded ADMIN_EMAIL so there's always one admin.
export const ADMIN_EMAIL = "admin@leadqonnect.com";

function jwtSecret(): Uint8Array {
  // JWT_SECRET is optional: fall back to the (already-required, private) Turso auth token so
  // there's one fewer env var to configure. The signing key stays stable and secret either way.
  const s = process.env.JWT_SECRET || process.env.TURSO_AUTH_TOKEN;
  if (!s) throw new Error("No signing secret — set JWT_SECRET or TURSO_AUTH_TOKEN.");
  return new TextEncoder().encode(s);
}

// --- Passwords (scrypt: salt + hash, stored as "salt:hash" hex) ---
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// --- JWT sessions ---
export interface Session { uid: string; email: string }

export async function signToken(session: Session): Promise<string> {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.uid)
    .setIssuedAt()
    .setExpirationTime(`${JWT_TTL_DAYS}d`)
    .sign(jwtSecret());
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (!payload.sub) return null;
    return { uid: String(payload.sub), email: String(payload.email || "") };
  } catch {
    return null;
  }
}

/** Extract + verify the bearer token from a request. Returns null if absent/invalid. */
export async function getSession(req: { headers: Record<string, unknown> }): Promise<Session | null> {
  const raw = req.headers["authorization"] || req.headers["Authorization"];
  const header = Array.isArray(raw) ? raw[0] : (raw as string | undefined);
  if (!header || !header.startsWith("Bearer ")) return null;
  return verifyToken(header.slice(7).trim());
}

export const newUid = () => "u_" + randomUUID().replace(/-/g, "");

// --- The public user shape the frontend consumes (mirrors what it read from Firestore) ---
export interface UserRow {
  uid: string; email: string; name: string; photo_url: string | null;
  plan: string; status: string; role: string;
  team_role: string | null; parent_uid: string | null;
  reddit: string | null; gmail: string | null; razorpay: string | null;
}

export async function findUserByEmail(email: string): Promise<any | null> {
  const res = await db().execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.toLowerCase()] });
  return res.rows[0] || null;
}

export async function findUserByUid(uid: string): Promise<any | null> {
  const res = await db().execute({ sql: "SELECT * FROM users WHERE uid = ?", args: [uid] });
  return res.rows[0] || null;
}

/** Shape a DB row into the profile object the client expects (camelCase-ish, JSON parsed). */
export function publicUser(row: any) {
  return {
    uid: row.uid,
    email: row.email,
    name: row.name || row.email?.split("@")[0] || "User",
    photoURL: row.photo_url || null,
    plan: row.plan || "free",
    status: row.status || "active",
    role: row.role || "user",
    teamRole: row.team_role || null,
    parentUid: row.parent_uid || null,
    reddit: row.reddit ? JSON.parse(row.reddit) : null,
    gmail: row.gmail ? JSON.parse(row.gmail) : null,
    razorpay: row.razorpay ? JSON.parse(row.razorpay) : null,
  };
}

export { nowSec };
