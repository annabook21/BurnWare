# BurnWare Anonymity: Research & Best-Solution Design

**Research date:** February 2026  
**Sources:** IACR, IETF, CISA, academia, industry (Signal, Tor, Oblivious HTTP)

---

## 0. What BurnWare Is (and Isn’t)

**BurnWare is not Tor.** We provide **application-level** anonymity only:

- **We do:** Don’t store or log your identity (no account required, no IP or fingerprint in our app or DB). Random per-thread IDs; no linkage across threads.
- **We don’t:** Hide your network identity. Your IP and traffic are visible to the hosting provider (e.g. AWS), CDN (CloudFront), WAF, and your ISP. There is no onion routing, no mix network, no traffic-analysis resistance.

For **network-level** anonymity (e.g. hiding from your ISP or the host), use Tor or a VPN and access BurnWare through it; we don’t provide that ourselves.

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

---

## 7. Future: How to Achieve Tor-Level (or Stronger) Anonymity

If you want to move toward network-level anonymity so the server (and host) cannot see the client’s IP or traffic pattern, these options are ordered by effort and impact.

### 7.1 Use Tor (or a VPN) to access BurnWare — no code change

- **Senders:** Use the Tor Browser (or Tor + normal browser) and open your BurnWare frontend URL. Traffic is onion-routed; your IP is hidden from the site and your ISP.
- **You:** No backend/frontend changes. Optional: document the .onion URL if you add a hidden service (see below).
- **Limitation:** Only helps users who choose to use Tor; the app itself doesn’t enforce or provide it.

### 7.2 Run BurnWare as a Tor Onion Service (hidden service)

- **What:** Host the frontend (and optionally the API) as a Tor hidden service so users can reach you at a `.onion` address. Traffic to your service is over Tor; you never see the client’s real IP.
- **How:** Run a Tor daemon on a host that can reach your frontend/API (or a reverse proxy in front of them). Configure a hidden service in `torrc`; you get a `.onion` URL. Point users (and docs) to that URL.
- **References:** [Tor Hidden Services](https://community.torproject.org/onion-services/), [Tor Manual](https://2019.www.torproject.org/docs/tor-onion-service-manual.html.en).
- **Effort:** Medium (new deployment path or proxy; no app logic change). You still run your current stack; Tor sits in front for that entry point.

### 7.3 Oblivious HTTP (OHTTP) — server never sees client IP

- **What:** Clients send requests through an OHTTP relay. The relay sees the client IP; your origin server does not. Good for “anonymous submit” forms and APIs.
- **How:** Integrate an OHTTP relay (e.g. [Cloudflare’s OHTTP relay](https://blog.cloudflare.com/oblivious-http)) or run your own (IETF RFC 9458). The frontend or a small client-side layer encrypts requests for the relay; the relay forwards to your API without exposing client IP.
- **References:** [RFC 9458 Oblivious HTTP](https://www.rfc-editor.org/rfc/rfc9458.html), [Cloudflare OHTTP](https://blog.cloudflare.com/oblivious-http).
- **Effort:** Higher (new protocol integration, key config, possibly a different entry URL for “anonymous” traffic). Best for anonymous send + optional thread view, not full site.

### 7.4 End-to-end encryption (E2EE)

- **What:** Senders encrypt message content in the browser; only the recipient can decrypt. You store ciphertext only; no plaintext on your server.
- **How:** Generate or derive a key per link (or per thread); sender gets the recipient’s public key from the link metadata, encrypts with it, sends ciphertext. Recipient decrypts in the dashboard with their private key (or key derived from something only they have).
- **References:** [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), [Signal’s Double Ratchet](https://signal.org/docs/) for advanced multi-message.
- **Effort:** Medium–high (key exchange UX, key storage or derivation, and making thread view decrypt in-browser). Does not hide who talks to whom or when; it hides content from the server.

### 7.5 Combine for strongest anonymity

- **Tor + OHTTP:** Sender uses Tor and submits via OHTTP so neither the relay (in practice) nor your origin sees the real IP.
- **Tor + E2EE:** Sender uses Tor; content is E2EE so the server never sees plaintext. Good for high-threat users who need both network and content protection.

**Practical order:** (1) Document “use Tor Browser for network anonymity” and optionally (2) add an onion service so users have a single Tor URL. Then consider OHTTP for the send API and E2EE for content if you need stronger guarantees.

---

## 8. What’s Special About Signal (and How BurnWare Compares)

Signal is a **private messenger** focused on minimizing what the server (and anyone else) can see. Here’s what makes it stand out and how BurnWare differs.

### What makes Signal special

1. **End-to-end encryption (E2EE) by default**  
   Message content is encrypted on the sender’s device and decrypted only on the recipient’s. The server only sees ciphertext; it never has the keys. Uses the [Signal Protocol](https://signal.org/docs/) (Double Ratchet, 3-DH, Curve25519, AES-256).

2. **Metadata minimization**  
   Signal is designed to retain as little as possible: no logs of who messaged whom, no contact lists or social graph, no conversation lists, no group metadata (titles, avatars, membership) stored in a way the server can read. [Sealed Sender](https://signal.org/blog/sealed-sender/) hides sender identity on the envelope so the server doesn’t see “A sent to B.”

3. **No ads, no trackers, nonprofit**  
   Independent nonprofit; revenue from donations, not ads or selling data. No third-party trackers.

4. **Open protocol and clients**  
   Signal Protocol is open; other apps (WhatsApp, Messenger optional mode, etc.) use it. Clients are open source so the design can be audited.

5. **Identity model**  
   You sign up with a phone number; identity is “who has this number,” not “anonymous.” So Signal is **private** (content and metadata hidden from the server) but not **anonymous** (recipient and server know your number).

### Signal vs BurnWare

| Aspect | Signal | BurnWare |
|--------|--------|----------|
| **Purpose** | Private 1:1 and group chat; you know who you’re talking to. | One-way or two-way messages to a **link**; sender can be unknown to the link owner. |
| **Identity** | Phone number (or optional username). Not anonymous. | Sender: no account, random per-thread ID. Recipient: Cognito account. |
| **Message content** | E2EE; server never sees plaintext. | Server stores and can read content; no E2EE. |
| **Metadata** | Minimized; Sealed Sender hides who-sent-to-whom from server. | We don’t store IP/UA or link threads to a persistent identity; metadata still exists (e.g. which link, when). |
| **Network** | Server sees client IP (unless user uses Tor/VPN). | Same: we don’t hide IP; Tor/VPN is user’s choice. |
| **Who sees what** | Only the two (or group) participants see content. | Link owner sees messages; we see everything on the server. |
| **Best for** | “I want private chats with people I know.” | “I want to receive or send feedback/messages without revealing who I am to the link owner (or vice versa).” |

### Summary

- **Signal** = private messaging with strong E2EE and metadata protection; identity is still your number/account.
- **BurnWare** = link-based, “send to this inbox” with **application-level** sender anonymity (no account, no stored identity); server can read message content (no E2EE) and there is no network-level anonymity.

So Signal is special for **privacy of content and metadata** between known or discoverable identities; BurnWare is special for **sender anonymity toward a link owner** and burn-after-reading, with the caveat that we’re not Tor and we don’t encrypt content on the server.
