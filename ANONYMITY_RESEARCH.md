# BurnWare Anonymity: Research & Best-Solution Design

**Research date:** February 2026  
**Sources:** IACR, IETF, CISA, academia, industry (Signal, Tor, Oblivious HTTP)

---

## 1. Industry Best Practices (2025–2026)

### 1.1 Metadata Protection (Signal, Echomix, Generic Anonymity Wrapper)
- **Principle:** Hide metadata (who talks to whom, when, how often) from servers and observers.
- **Techniques:** Generic Anonymity Wrapper (AW) for messaging, mix networks, traffic analysis resistance.
- **Key insight:** Metadata is often more revealing than message content.

### 1.2 IP & Log Anonymization (IETF, RFC 6235, IPCrypt, Salt-Based Hashing)
- **Principle:** Minimize or eliminate storage of raw IPs; when needed, use non-reversible or rotating-key methods.
- **IPCrypt options:**
  - **Non-deterministic (ND):** Different output each time — no correlation across events.
  - **Prefix-preserving (PFX):** Retains network structure for analytics without host identity.
  - **Salt-based per-octet hashing:** Non-reversible, preserves some structure for correlation within logs only.
- **Best practice:** If you don’t need IP, don’t collect it. If you need it for rate limiting, use it only in-memory with a short TTL and never persist.

### 1.3 CISA Guidance (2025)
- Use end-to-end encrypted messaging.
- Minimize metadata collection and storage.
- Assume nation-state interception is possible.
- Use disappearing messages where appropriate.

### 1.4 Oblivious HTTP (RFC 9458)
- Clients make requests via relays so the origin server never sees the client IP.
- Requires a relay/proxy architecture; higher latency.
- Best for high-threat environments (journalists, activists).

### 1.5 Zero-Knowledge / Minimal Trust
- Service provider never sees plaintext.
- No stored identifiers that can link sender across requests.
- Each anonymous action uses a fresh, unlinkable identifier.

---

## 2. BurnWare Current State

| Area | Current Implementation | Risk Level |
|------|------------------------|-----------|
| **sender_anonymous_id** | Random per-thread (`CryptoUtils.generateRandomString(8)`), not derived from IP/UA | Low |
| **Messages** | No IP, no fingerprint, no linkage across threads | Low |
| **Audit log** | No `ip_address` column | Low |
| **Application logs** | IP and User-Agent omitted | Low |
| **Rate limiting** | Uses `req.ip` as key (in-memory / Redis) | Medium |
| **ALB access logs** | May log client IP (AWS default) | Medium |
| **WAF** | Logs IP for blocked requests | Medium |
| **X-Ray** | Request metadata may include IP | Low–Medium |

### Summary
BurnWare’s application layer is already strong: no IP or UA stored, random per-thread IDs, no cross-thread linkage. Remaining risks are at the edge (rate limit key, ALB, WAF) and observability (X-Ray).

---

## 3. Manufactured Best Solution

### Tier 1: Must-Have (Application Layer)

1. **Keep random `sender_anonymous_id`**
   - Do not derive from IP/UA.
   - One new thread per anonymous message.
   - No cross-thread linkage.

2. **Never persist IP**
   - No `ip_address` or `ip_hash` in DB.
   - No IP in application logs.

3. **Rate limiting for `/api/v1/send` without IP**
   - **Option A (recommended):** Use WAF rate limiting as primary; app-level rate limit can be global or captcha-based.
   - **Option B:** Use a short-lived, in-memory blind rate limit (e.g. hash(IP + rotating_salt) with 5-min TTL) — no persistence, no cross-session correlation.
   - **Option C:** Require CAPTCHA for anonymous send; rate limit by captcha session.

### Tier 2: Edge & Observability

4. **ALB access logs**
   - Disable or shorten retention for ALB access logs.
   - Or use field-level filtering (if supported) to drop client IP for `/api/v1/send`.

5. **WAF**
   - WAF needs IP for blocking; keep it.
   - Minimize WAF log retention; avoid shipping logs that include IP to long-term storage.

6. **X-Ray**
   - Do not add IP to trace metadata for anonymous endpoints.
   - Existing logging middleware already omits IP.

### Tier 3: Optional Hardening (Future)

7. **Oblivious HTTP relay**
   - Route anonymous sends through an OHTTP relay so the app never sees client IP.
   - Higher complexity and latency; suitable for higher-threat users.

8. **End-to-end encryption**
   - Encrypt message content client-side before send.
   - Server stores only ciphertext; key never leaves client.
   - Requires key exchange UX (e.g. per-link public key).

---

## 4. Recommended Implementation Changes

### 4.1 Rate limiting for anonymous sends (immediate)

For `POST /api/v1/send`, avoid using IP as the rate limit key:

```ts
// publicRateLimiter: use a generic key or captcha session
// Option: rate limit per link_id + optional captcha token (no IP)
keyGenerator: (req) => {
  const body = req.validated as { recipient_link_id?: string; captcha_token?: string };
  // Rate limit by link (abuse on one link doesn't affect others) + random nonce
  return body?.recipient_link_id 
    ? `link:${body.recipient_link_id}` 
    : `anon:${crypto.randomUUID()}`; // fallback: no correlation
},
```

Trade-off: per-link rate limiting can be gamed (create many links). A hybrid approach: WAF rate limit by IP (at edge), app rate limit by `link_id` or captcha session. The app never stores or logs IP.

### 4.2 Ensure logging never leaks IP

- ✅ Logging middleware already omits IP.
- Add an explicit checklist in code: never log `req.ip`, `req.headers['x-forwarded-for']`, or User-Agent for anonymous endpoints.

### 4.3 ALB & WAF configuration

- In CDK/infra: set short retention for ALB access logs (e.g. 1–7 days).
- Document that WAF logs contain IP and should have minimal retention.

---

## 5. Comparison Matrix

| Technique | BurnWare | Best Practice | Gap |
|-----------|----------|---------------|-----|
| Sender ID | Random per thread | Random, unlinkable | None |
| IP storage | None | None | None |
| IP in logs | Omitted | Omitted | None |
| Rate limit key | IP | Non-IP or blind hash | Yes — fix |
| ALB logs | May log IP | Disable/short retention | Review |
| WAF logs | IP for blocks | Minimal retention | Document |
| Metadata hiding | N/A (no metadata) | Mix/E2EE | Future |

---

## 6. Conclusion

BurnWare’s application design is already aligned with strong anonymity practices: no stored IP, no linkage across threads, random IDs. The main improvement is to stop using IP in rate limiting for anonymous sends and to tighten edge/observability handling. The recommendations above produce a robust anonymity profile for a burn-after-reading anonymous inbox without requiring Tor or mix networks.
