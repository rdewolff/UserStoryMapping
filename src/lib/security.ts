import type { NextRequest } from "next/server";

const FAILED_ATTEMPTS_LIMIT = 6;
const BASE_LOCKOUT_MS = 15_000;

type AttemptEntry = {
  count: number;
  lockUntil: number;
};

const attempts = new Map<string, AttemptEntry>();

function nowMs() {
  return Date.now();
}

export function getLoginRateLimitKey(email: string, request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "local";
  return `${email.toLowerCase()}::${ip}`;
}

export function isLoginRateLimited(key: string): { limited: boolean; retryAfterMs: number } {
  const entry = attempts.get(key);
  if (!entry) {
    return { limited: false, retryAfterMs: 0 };
  }

  const now = nowMs();
  if (entry.lockUntil <= now) {
    return { limited: false, retryAfterMs: 0 };
  }

  return { limited: true, retryAfterMs: entry.lockUntil - now };
}

export function registerFailedLogin(key: string): void {
  const now = nowMs();
  const existing = attempts.get(key) ?? { count: 0, lockUntil: 0 };

  const nextCount = existing.count + 1;
  let lockUntil = existing.lockUntil;

  if (nextCount >= FAILED_ATTEMPTS_LIMIT) {
    const multiplier = Math.max(1, nextCount - FAILED_ATTEMPTS_LIMIT + 1);
    lockUntil = now + BASE_LOCKOUT_MS * multiplier;
  }

  attempts.set(key, {
    count: nextCount,
    lockUntil,
  });
}

export function clearFailedLogins(key: string): void {
  attempts.delete(key);
}

export function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return false;
  }

  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  return origin === `${protocol}://${host}`;
}
