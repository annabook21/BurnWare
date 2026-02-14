# Broadcast Feature: Verification Against Current Online Sources

This document verifies the broadcast implementation against current AWS, React, and PostgreSQL best practices using published sources (2024–2025).

---

## 1. AWS and Security

### 1.1 Do not log sensitive data or PII

**Sources:**
- [AWS Well-Architected – Application logging](https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_detect_investigate_events_app_service_logging.html)
- [CloudWatch Logs data protection](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/data-protection.html)
- [Help protect sensitive log data with masking – CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html)

**Guidance:** Do not log credentials, API keys, or PII in tags, free-form text, or resource names. Use masking/data protection where needed.

**Our implementation:** Broadcast controller does not log request body (so `post_token` is never logged). Comment in code: *"Do not log request body (post_token) or identifiers on public routes."* GET posts rate limiter handler does not log IP or other identifiers. **Aligned.**

### 1.2 Store secrets securely / hash before storage

**Sources:**
- [AWS Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Password_Storage_Cheat_Sheet.md)

**Guidance:** Never hardcode secrets in code or logs. Use one-way hashing for verification where appropriate; for high-entropy tokens, hashing (e.g. SHA-256) for comparison is a common pattern.

**Our implementation:** Post token is generated with `crypto.randomBytes(32)`, hashed with SHA-256 via `CryptoUtils.hash()`, and only the hash is stored in `post_token_hash`. Plaintext token is returned once at creation. **Aligned.**

### 1.3 Rate limiting

**Sources:**
- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) – `keyGenerator` for custom identification
- [Securing APIs: Express rate limit – MDN](https://developer.mozilla.org/en-US/blog/securing-apis-express-rate-limit-and-slow-down)
- [How to Implement Rate Limiting in Express – AppSignal](https://blog.appsignal.com/2024/04/03/how-to-implement-rate-limiting-in-express-for-nodejs.html)

**Guidance:** Use rate limiting (e.g. 429 when exceeded). Custom `keyGenerator` is supported; for anonymity-sensitive routes, avoid logging identifiers.

**Our implementation:** Public broadcast routes use `publicRateLimiter` and `broadcastPostsRateLimiter` (GET posts: 200/15 min by IP). Handler throws `RateLimitError` without logging IP. **Aligned.**

---

## 2. React

### 2.1 Accessibility – ARIA menu and menuitem

**Sources:**
- [ARIA: menu role – MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role)
- [ARIA: menuitem role – MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menuitem_role)
- [React Aria useMenu](https://react-aria.adobe.com/Menu/useMenu)

**Guidance:**
- `role="menu"` for a list of actions; `role="menuitem"` for each item.
- Menu must have an accessible name (`aria-label` or `aria-labelledby`).
- When the menu opens, focus should move to the first menu item.
- Menu container: `tabindex="-1"` or `0`; items focusable (e.g. `tabindex="-1"`).
- Escape closes the menu and returns focus to the invoking context.

**Our implementation:** `BroadcastChannelContextMenu` uses `role="menu"`, `aria-label="Channel actions"`, `role="menuitem"` on each `MenuItem` (button). We focus the first item on open (`useEffect` + `ref`), handle Escape to close, use `tabIndex={-1}` on the menu container, and use `<button>` so items are focusable. **Aligned.** (Full arrow-key navigation would require additional focus management; current implementation covers Escape and initial focus.)

### 2.2 XSS prevention

**Sources:**
- [Preventing XSS in React – Open edX](https://docs.openedx.org/en/latest/developers/references/developer_guide/preventing_xss/preventing_xss_in_react.html)
- [Security – Hands on React](https://handsonreact.com/docs/security)
- [React JSX – React](https://reactjs.org/docs/introducing-jsx.html)

**Guidance:** React escapes values when creating DOM elements by default. Avoid `dangerouslySetInnerHTML` with user input.

**Our implementation:** Broadcast feed renders post content as `{post.content}` (no `dangerouslySetInnerHTML`). React’s default escaping applies. **Aligned.**

---

## 3. PostgreSQL

### 3.1 Parameterized queries

**Sources:**
- [Cursor Pagination for PostgreSQL & MySQL – Uptrace](https://bun.uptrace.dev/guide/cursor-pagination.html)
- [Understanding Offset and Cursor-Based Pagination – AppSignal](https://blog.appsignal.com/2024/05/15/understanding-offset-and-cursor-based-pagination-in-nodejs.html)

**Guidance:** Use parameterized placeholders for all user-supplied values to prevent SQL injection and ensure consistent behavior.

**Our implementation:** All queries use `$1`, `$2`, etc. (e.g. `broadcast-channel-model.ts`, `broadcast-post-model.ts`). No string concatenation of user input into SQL. **Aligned.**

### 3.2 Cursor-based pagination

**Sources:**
- [Don’t use LIMIT OFFSET for pagination in PostgreSQL – mirio.dev](https://mirio.dev/2024/08/03/pagination-in-postgresql/)
- [Optimizing SQL Pagination in Postgres – Readyset](https://readyset.io/blog/optimizing-sql-pagination-in-postgres)
- [Cursor Pagination – Uptrace](https://bun.uptrace.dev/guide/cursor-pagination.html)

**Guidance:**
- Prefer cursor-based pagination over large OFFSET (OFFSET scans and discards rows).
- Use a composite cursor (e.g. `(created_at, id)`) for stable, unique ordering.
- Index columns used in cursor comparison (e.g. `(channel_id, created_at DESC)`).

**Our implementation:** We use `before=<post_id>` with a subquery on `(created_at, post_id)` scoped by `channel_id`. Index `idx_broadcast_posts_channel_created ON broadcast_posts(channel_id, created_at DESC)`. **Aligned.**

---

## 4. Code change made after verification

- **BroadcastChannelContextMenu:** Added focus management and `tabIndex` per MDN:
  - Focus moves to the first menu item when the menu opens (`useRef` + `useEffect`).
  - Menu container has `tabIndex={-1}`.
  - Escape still closes the menu.

---

## 5. Summary

| Area              | Practice                          | Source type        | Status   |
|-------------------|-----------------------------------|--------------------|----------|
| AWS / Security    | No logging of secrets or PII      | AWS, CloudWatch    | Aligned  |
| AWS / Security    | Hash token before storage         | OWASP, AWS         | Aligned  |
| API               | Rate limiting, no IP in handler   | express-rate-limit, MDN | Aligned  |
| React             | ARIA menu + menuitem, focus, Escape | MDN, React Aria    | Aligned  |
| React             | No dangerouslySetInnerHTML for feed | React, Open edX    | Aligned  |
| PostgreSQL        | Parameterized queries             | Uptrace, AppSignal | Aligned  |
| PostgreSQL        | Cursor pagination + index         | mirio, Readyset    | Aligned  |

All broadcast-related code has been checked against the above current online sources and matches the stated practices where applicable.
