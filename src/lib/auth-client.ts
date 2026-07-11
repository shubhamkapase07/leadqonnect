// Client-side auth against the new Turso+Vercel backend (replaces Firebase Auth).
// Exposes the same conceptual operations AppContext used: login, signup, logout, and a
// "who am I" check that also carries the profile fields the old user-doc snapshot provided.

import { apiGet, apiPost, setToken, clearToken, getToken, ApiError } from './api';

// Minimal user shape the app reads (drop-in for the old FirebaseUser: .uid/.email/.displayName/.photoURL).
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// The live profile fields that used to arrive via the users/{uid} onSnapshot.
export interface Profile {
  plan: 'free' | 'trial' | 'premium' | 'agency';
  status: 'active' | 'suspended';
  role: 'user' | 'admin';
  teamRole: 'leader' | 'member' | null;
  parentUid: string | null;
  reddit: any | null;
  gmail: any | null;
  razorpay: any | null;
}

export interface AuthResult { user: AuthUser; profile: Profile }

// Map the API's publicUser payload into the app's (user, profile) split.
function shape(u: any): AuthResult {
  return {
    user: {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.name ?? null,
      photoURL: u.photoURL ?? null,
    },
    profile: {
      plan: u.plan || 'free',
      status: u.status || 'active',
      role: u.role === 'admin' ? 'admin' : 'user',
      teamRole: u.teamRole === 'leader' ? 'leader' : u.teamRole === 'member' ? 'member' : null,
      parentUid: u.parentUid || null,
      reddit: u.reddit || null,
      gmail: u.gmail || null,
      razorpay: u.razorpay || null,
    },
  };
}

export async function apiSignup(name: string, email: string, password: string): Promise<AuthResult> {
  const { token, user } = await apiPost<{ token: string; user: any }>('/api/auth/signup', { name, email, password });
  setToken(token);
  return shape(user);
}

export async function apiLogin(email: string, password: string): Promise<AuthResult> {
  const { token, user } = await apiPost<{ token: string; user: any }>('/api/auth/login', { email, password });
  setToken(token);
  return shape(user);
}

export async function apiLogout(): Promise<void> {
  try { await apiPost('/api/auth/logout'); } catch { /* stateless — ignore */ }
  clearToken();
}

/** Resume a session from a stored token. Returns null if no/invalid token. */
export async function apiMe(): Promise<AuthResult | null> {
  if (!getToken()) return null;
  try {
    const { user } = await apiGet<{ user: any }>('/api/auth/me');
    return shape(user);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) clearToken();
    return null;
  }
}

// Turn an API error code into a friendly message (replaces Firebase's auth/* codes).
export function friendlyAuthError(code?: string): string {
  switch (code) {
    case 'invalid_credentials': return 'Invalid email or password. Please try again.';
    case 'email_in_use': return 'An account with this email already exists. Try logging in instead.';
    case 'weak_password': return 'Password should be at least 6 characters.';
    case 'invalid_email': return 'Please enter a valid email address.';
    case 'suspended': return 'This account has been suspended.';
    case 'missing_credentials': return 'Please enter your email and password.';
    default: return 'Something went wrong. Please try again.';
  }
}
