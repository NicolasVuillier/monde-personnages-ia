import { getDb } from "@/db";

export const DAILY_CHAT_LIMIT = 30;

const ANONYMOUS_COOKIE = "world_chat_user";
const ANONYMOUS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PARIS_TIME_ZONE = "Europe/Paris";

type QuotaRow = {
  messageCount: number;
};

export type ChatQuota = {
  allowed: boolean;
  day: string;
  limit: number;
  remaining: number;
  setCookie?: string;
};

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }

  return null;
}

function parisCalendarDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function quotaIdentity(request: Request): Promise<{ hash: string; setCookie?: string }> {
  const authenticatedEmail = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLocaleLowerCase("en");

  if (authenticatedEmail) {
    return { hash: await sha256(`account:${authenticatedEmail}`) };
  }

  const existingAnonymousId = readCookie(request, ANONYMOUS_COOKIE);
  const hasValidAnonymousId = Boolean(
    existingAnonymousId && /^[a-f0-9-]{20,80}$/i.test(existingAnonymousId),
  );
  const anonymousId = hasValidAnonymousId
    ? existingAnonymousId!
    : crypto.randomUUID();

  return {
    hash: await sha256(`anonymous:${anonymousId}`),
    setCookie: hasValidAnonymousId
      ? undefined
      : `${ANONYMOUS_COOKIE}=${encodeURIComponent(anonymousId)}; Path=/; Max-Age=${ANONYMOUS_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  };
}

export async function reserveDailyChatMessage(request: Request): Promise<ChatQuota> {
  const identity = await quotaIdentity(request);
  const day = parisCalendarDay();
  const db = getDb();

  const reserved = await db.prepare(`
    INSERT INTO daily_chat_usage (identity_hash, usage_date, message_count, updated_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(identity_hash, usage_date) DO UPDATE SET
      message_count = message_count + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE daily_chat_usage.message_count < ?
    RETURNING message_count AS messageCount
  `).bind(identity.hash, day, DAILY_CHAT_LIMIT).first<QuotaRow>();

  if (!reserved) {
    return {
      allowed: false,
      day,
      limit: DAILY_CHAT_LIMIT,
      remaining: 0,
      setCookie: identity.setCookie,
    };
  }

  return {
    allowed: true,
    day,
    limit: DAILY_CHAT_LIMIT,
    remaining: Math.max(0, DAILY_CHAT_LIMIT - reserved.messageCount),
    setCookie: identity.setCookie,
  };
}

export function quotaHeaders(quota: ChatQuota): Headers {
  const headers = new Headers({
    "X-RateLimit-Limit": String(quota.limit),
    "X-RateLimit-Remaining": String(quota.remaining),
  });
  if (quota.setCookie) headers.set("Set-Cookie", quota.setCookie);
  return headers;
}
