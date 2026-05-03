// Shared auth helpers.
//
// We never store raw GitHub OAuth tokens. The Contributor row carries
// `oauth_token_hash` (sha256 hex of the raw token). On `POST /submit`,
// the contributor passes their raw token in the Authorization header;
// we hash it and look the row up by hash. If the row's hash doesn't
// match anyone, 401.

import { createHash } from "node:crypto";

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Parse "Authorization: Bearer <token>" or return null. */
export function parseBearer(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const m = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  if (!m) return null;
  const token = m[1]?.trim();
  return token && token.length > 0 ? token : null;
}
