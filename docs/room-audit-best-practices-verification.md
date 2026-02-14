# Room Feature Audit — Best Practices Verification

This document maps each fix from the room-feature audit to published React, API, and AWS best practices (2024–2025) so the changes can be confirmed against external guidance.

---

## 1. Rate limiting on status polling endpoint

**Fix:** Applied `roomStatusRateLimiter` to `GET /api/v1/rooms/:room_id/status`.

**Sources:**

- **Merge.dev, “7 best practices for polling API endpoints”**  
  Use rate limiting as part of API design; protect stability and fair usage; document limits and error behavior.

- **Tyk, “API rate limiting explained”**  
  Rate limiting protects availability and prevents abuse; combine with clear error behavior (e.g. 429).

- **OWASP REST Security Cheat Sheet**  
  Return `429 Too Many Requests` when requests exceed rate limits.

- **AWS Well-Architected (REL05-BP02)**  
  Throttle requests; apply usage plans and per-client throttles; use token-bucket semantics and client retry/backoff.

**Verification:** Adding application-level rate limiting to the status polling route aligns with industry guidance to protect the API and return 429 when appropriate.

---

## 2. Path parameter validation (invite_id)

**Fix:** Added `inviteIdSchema` (room_id + invite_id as UUIDs) and `validateParams(inviteIdSchema)` on `DELETE .../invites/:invite_id`.

**Sources:**

- **OWASP REST Security Cheat Sheet — Input validation**  
  Do not trust input parameters; validate length, range, format, and type; use strong types (e.g. UUID) and validation/sanitization libraries.

- **OpenAPI / REST**  
  Path parameters should be required and modeled with a proper type (e.g. UUID format or pattern) for validation and docs.

- **Express + Joi (2024)**  
  Validate path params with a Joi schema (e.g. `Joi.object({ id: Joi.string().uuid() })`) in middleware before route logic; treat validation as a security gatekeeper.

**Verification:** Validating both `room_id` and `invite_id` as UUIDs in path params matches recommended input validation and security practice.

---

## 3. Cursor validation for messages pagination

**Fix:** Validate cursor format (ISO date + UUID for message_id) in `getMessages`; on invalid cursor, fall back to first page instead of passing bad values to the DB.

**Sources:**

- **Bun / Cursa cursor pagination**  
  Validate type/length before using a cursor; decode and assert required fields; for invalid cursors either return a clear 4xx or treat as “start from beginning”; make behavior explicit.

- **GraphQL / Apollo**  
  Ensure cursor corresponds to current ordering/schema; defensive checks to avoid expensive or incorrect queries from malformed cursors.

**Verification:** Validating cursor shape and falling back to the first page on invalid input is consistent with “validate then use or fall back” and avoids bad DB inputs.

---

## 4. Join flow: create participant then redeem invite

**Fix:** In `joinRoom`, create the participant first, then call `inviteModel.redeem(invite_id)`. Previously the invite was redeemed before creating the participant.

**Sources:**

- **Database transaction best practices (PostgreSQL, Go, Django)**  
  Prefer doing create/reserve operations in a transaction so the unit is atomic and you avoid orphaned reservations or consumed tokens with no corresponding resource.

- **One-time token / limited-use token guidance (Gmail, StackOverflow)**  
  Redemption logic should “validate-and-mark-used” in conjunction with the action; the token should be invalidated as part of or after the successful action so the first request performs the action and repeat requests are handled safely.

- **OWASP — Preventing out-of-order API execution**  
  Enforce workflow state validation on the server; avoid relying on frontend ordering.

**Verification:** Consuming the one-time invite only after the participant is successfully created avoids burning the token on create failure and matches “consume after successful action.” A single DB transaction (create participant + redeem) would be a further improvement; the current fix already aligns with the intended order.

---

## 5. Revoke invite scoped to room (resource ownership)

**Fix:** Invite model now has `revokeForRoom(roomId, inviteId)` (UPDATE … WHERE invite_id = $1 AND room_id = $2). Service uses it and returns 404 if no row is updated.

**Sources:**

- **OWASP Multi-Tenant Security Cheat Sheet**  
  Validate resource ownership from verified context; do not trust client-supplied resource/tenant IDs; establish and propagate validated context.

- **AWS / Azure multi-tenant API guidance**  
  Validate that the caller is authorized for the specific resource; avoid accepting user-supplied resource URIs that could refer to another tenant’s resources.

- **OWASP REST Security Cheat Sheet — Access control**  
  Ensure the caller is authorized to perform the operation on the resource collection and record.

**Verification:** Revoking only when `invite_id` belongs to the given `room_id` (which the user is already allowed to manage) enforces resource ownership and prevents cross-room revoke.

---

## Summary table

| Fix | Practice | Source type |
|-----|----------|-------------|
| Rate limit status endpoint | Rate limit polling/status; return 429 | Merge.dev, Tyk, OWASP REST, AWS |
| Validate invite_id (path) | Validate path params; UUID/schema | OWASP REST, OpenAPI, Express+Joi |
| Validate cursor / fallback | Validate cursor; fallback or 4xx | Cursa, Bun, GraphQL |
| Create then redeem | Consume one-time token after success | DB transactions, one-time token guidance |
| Revoke scoped to room | Validate resource ownership | OWASP Multi-Tenant, AWS/Azure API |

---

## React-specific note

The room feature fixes are mostly backend/API (validation, rate limiting, workflow order, authorization). The earlier React-side change—running status polling with recursive `setTimeout` and immediate first run—was already confirmed against 2024 polling best practices (e.g. Fotis Adamakis, DEV.to). No additional React-specific research was required for these audit fixes.

---

*Generated to confirm room audit fixes against published best practices (React, REST, AWS, OWASP).*
