# Broadcast: One-to-Many Anonymous Messaging

## Goal

Allow **one sender to broadcast messages to potentially millions of unidentified users anonymously**. Recipients don’t need accounts or identity—anyone with the channel URL can read. Think: one-way broadcast channel, not chat.

**Primary use case: politically oppressive regimes.** People need to distribute information (e.g. protests, evidence, safety instructions) without the platform being able to identify who created the channel, who posted, or who read. Design must minimize attribution risk and data that could harm users if seized or subpoenaed.

**Concrete example: sharing recent interactions and locations of suspected ICE agents.** Communities need a way to broadcast where ICE has been seen or where recent interactions occurred—so others can avoid those areas or stay aware. Contributors post updates (e.g. “Checkpoint at [intersection] as of 2pm,” “ICE activity near [landmark] this morning”); readers get a time-ordered feed of recent reports. No accounts, no login, no attribution. The channel is shared via link or QR (e.g. at community centers, via mutual-aid networks); anyone with the link can read the latest. Recency and location are central: the feed is newest-first, and posts naturally carry location and time in their content (with optional structured location fields possible later for map display).

**Design constraints:** The **channel must be persistent** (stable URL, no default auto-expiry) so it can be disseminated to millions. The **channel must be shareable via link or QR code** so creators can distribute it (e.g. paste the link, print a QR for flyers or posters). **Do not require authentication to access the link**: opening the read URL or scanning the QR must work without login, account, or any credentials. **Contributors to the channel must be anonymous and hidden**: no names, no per-post attribution, no way for readers or the platform to know who wrote which post. The channel may have one or many people who can post (via a shared post token); either way, contributor identity is never stored or exposed.

## Why the room feature didn’t fit

The room feature was **multi-party chat**:

- Two-way conversation (everyone sends and receives)
- Identified participants (invites, approval, display names)
- E2EE group keys, join windows, max 10 people
- Complex state: participants, status, wrapped keys

Broadcast is the opposite:

- **One-way**: one (or one anonymous) poster → many readers
- **No recipient identity**: we never store who is reading
- **Unbounded readers**: scale to millions by not tracking them
- **Simple read path**: “give me the latest N posts for this channel”

So the right model is a **broadcast channel**, not a chat room.

---

## Conceptual model

| Concept        | Inbox (current)              | Broadcast (proposed)           |
|----------------|------------------------------|---------------------------------|
| Link / channel | One link = one inbox         | One channel = one broadcast feed |
| Sender         | Many anonymous senders       | Anonymous contributor(s); no identity stored or shown |
| Recipients     | One owner (reads threads)    | Many unidentified readers (no account) |
| Data           | Threads + messages           | Channel + posts                 |
| Reader auth    | Owner logs in                | None—possession of URL is enough |

---

## Practical dissemination at scale

To reach millions, the channel URL must stay valid so it can be shared, re-shared, and bookmarked. Real-world examples (e.g. Telegram-style channels, NEXTA Live during Belarus protests—1.7M+ subscribers, 1B views) relied on **persistent** channels: the same link worked for a long time, enabling viral spread. Ephemeral channels (auto-delete in 24–72h) prevent that kind of reach.

- **Stable URL:** The channel read URL (e.g. `https://app/b/:channel_id`) should remain valid so that when someone opens it days or weeks later, it still works. No auto-expiry by default.
- **Shareable via link or QR code:** The channel is shared by giving out the read URL (as a link) or as a QR code that encodes that URL. Creators can paste the link in messages, social posts, or other apps; or generate a QR code to print on flyers, posters, or stickers.
- **No authentication for the link:** Accessing the channel (opening the read URL or scanning the QR) must not require authentication. No login, no account, no credentials. Anyone with the link can read; the link is the only requirement.
- **No central directory:** Channels are discovered by **link sharing** (or QR) only—word of mouth, other apps, flyers. There is no search and no listing. “How do millions find it?” Answer: share the link or the QR.
- **Persistence enables reach:** Short-lived channels suit small, time-bound ops; for maximum dissemination, the channel must persist so the link can spread. In our design we never store creator/poster/reader identity, so keeping the channel up longer does not increase attribution risk.
- **“Tracked well”:** Here “tracked” means the link is **stable and reusable** (shareable, bookmarkable). We do not add server-side analytics or reader tracking.

---

## Similar applications and research (United States, 2026 political climate)

The following projects are relevant to the **United States political climate of 2026**: community safety around immigration enforcement (ICE), protest coordination and mutual aid, and surveillance resistance for activists and journalists. They inform design choices for a US-deployed broadcast tool (e.g. ICE location/interaction reporting, shareable via link or QR without auth).

### Immigration / enforcement community alerts (ICE, raids, checkpoints) — US

- **[Cosecha/redadalertas](https://github.com/Cosecha/redadalertas)** — Web app for crowdsourcing immigration raid data; real-time, verified alerts. React front end; separate API. Movimiento Cosecha; GPL-3.0. US-focused.
- **[chinga-la-migra](https://github.com/matthewboman/chinga-la-migra)** — Open map for marking ICE/police/DHS checkpoints. Front-end only; share URL with trusted people; anyone can add checkpoints.
- **[galvanitic/sirenos](https://github.com/galvanitic/sirenos)** — React app to track ICE activity across the U.S.; interactive map, filter by date, report by address or current location. “Stay safe.”
- **Eyes Up** (explorealways) — Privacy-first: no login, no personal data; capture video, secure upload, pin to public map. Protects recorder and recorded. US immigration enforcement context.
- **Salient Alert** — React/Express/MongoDB/Mapbox; real-time community reporting of ICE raids/checkpoints to help people avoid enforcement.

**Other US community tools (closed or hybrid):** Vecinos (real-time ICE alerts, anonymous, no location tracking, bilingual); Red Dot (iOS, anonymous reporting, reports auto-delete 5h); Juntos (“Waze for immigration safety,” encrypted, 24h auto-delete); ICE Watch; TrakICE (Minnesota, no location tracking, stripped metadata, auto purge). All emphasize anonymity and no/minimal data collection.

**Takeaways:** No login, location + time, real-time/crowdsourced, share via link; many use maps. Our design aligns: no auth for read link, time-ordered feed, optional structured location later.

### Protest coordination and mutual aid — US

- **JayWalk** (Tech for Palestine) — App to help protesters stay safe and coordinate: list events by cause, find protests, (planned) live map of first aid/observers and alerts (tear gas, rubber bullets, arrests). Inspired by mutual aid during George Floyd protests. [TechForPalestine on GitHub](https://github.com/techforpalestine).
- **RESIST** (resist.rocks) — Decentralized organizing (Bluesky AT Protocol); geo “dots” to find nearby people, real-time volunteer opportunities, report injustice, organize actions. Launched July 2024.
- **Buoy.Earth** — Pay-what-you-can neighborhood/mutual aid coordination: map of alerts and updates, dashboard, plan and respond to emergencies together.
- **Flash Protest** (Antifascist Fun Brigade) — Free, web-based push-to-talk; no app, no login, no auth; geofenced room via link for walkie-talkie-style coordination.
- **Civic Security Guide** (Lumpen Camp) — Protest comms: encrypted messaging (Signal, Briar), low-tech (runners, hand signals), opsec.

**Takeaways:** Link/shareable access without login; real-time alerts and location; anonymity and minimal data; some use maps. Our broadcast channel fits as a simple, persistent feed (link + QR) for time-sensitive location/activity reports.

### Surveillance resistance and secure comms — US activists and journalists

- **[briar/briar](https://github.com/briar/briar)** — Messaging for activists and journalists. No central server; sync over Bluetooth, Wi-Fi, or Tor. Works when internet is down. Reproducible builds.
- **LibertyGuard** — US-focused activism app: threat alerts, encrypted organizer messaging, protest coordination, legal rights, emergency protocols offline; resistance guides; democracy health dashboard.
- **EFF, “Surveillance Defense for Campus Protests”** (2024) — Practical security for campus protests and law-enforcement surveillance.
- **Turn Off Your Phone** (turnoffyourphone.org) — Opsec guide for 2024 activists (e.g. Palestine organizing in NYC): phone-specific threats, pocket zines, full guide.
- **Activist Checklist** — Security essentials to reduce digital trails (location, comms, network mapping) that law enforcement can use.

**Takeaways:** Metadata and identity minimization matter for US activists facing law enforcement. We keep a simple server but store no creator/poster/reader identity and avoid identifying logs so the platform has little to hand over.

### Location-based anonymous messaging (reference)

- **[tomyo/locpost](https://github.com/tomyo/locpost)** — Location-based anonymous messages; GUN distributed DB in browser; location-gated channel. Demo: tomyo.github.io/locpost.
- **[OpenHerd](https://openherd.network/)** — P2P, anonymous, location-based board; fuzzed coordinates; no central server. Offline-friendly.

**Takeaways:** Location + anonymity; we use a single channel URL and put location in post content or optional structured fields.

### Summary for our design (US 2026)

| Concern | Similar apps (US context) | Our approach |
|---------|---------------------------|--------------|
| No login / no auth for readers | RedadAlertas, Eyes Up, chinga-la-migra, Sirenos, Flash Protest, Vecinos, Red Dot | Read link and QR require no auth. |
| Location + recency | RedadAlertas, Salient Alert, Sirenos, JayWalk, RESIST, Juntos | Newest-first feed; location in content; optional lat/lng later. |
| Anonymous contributors | Eyes Up, Vecinos, Red Dot, Juntos, OpenHerd | No per-post attribution; post token only. |
| Persistent, shareable channel | RedadAlertas, community ICE tools | Persistent by default; link + QR. |
| Law enforcement / subpoena risk | Briar, EFF guides, LibertyGuard, Activist Checklist | No identity stored or logged; minimal data. |

### Further research: Reddit, InfoQ, Fowler, Medium, Stack Overflow

Additional sources that reinforce design choices for US 2026–relevant broadcast and community alerts:

**Reddit and community practice**

- **StopICE (stopice.net)** — Deliberately **no downloadable app**: “Service providers log your device IMEI with each app you download.” Alerts via text and web; zipcode-based geolocation (not raw GPS) to limit tracking; crowdsourced reports; Sherman Austin / RaiseTheFist. First Amendment framing; encrypted signup data.
- **ICEOut.org** — Community “Observed ICE” sightings. Reddit (e.g. r/TwinCities) discussions stress **verification**: posting “suspicious vehicles” as observed ICE creates alarm and inaccuracy; criteria for “Observed” (e.g. ICE visible, warnings of raids) keep the feed useful.
- **Rapid response networks** — Hotlines (e.g. Santa Cruz Pajaro Valley 831-239-4289); verify with groups like NorCal Resist before sharing. Reinforces: time-sensitive + location, but accuracy and verification matter for trust.

**Martin Fowler**

- **[Privacy Protects Bothersome People](https://martinfowler.com/articles/bothersome-privacy.html)** — Privacy matters for democracy because it protects journalists and activists who “bother” the powerful. With metadata (who called whom, where), power can find sources, supporters, and vulnerabilities to discredit or block them. “If we can’t protect the privacy of those who bother the powerful, we lose a vital pillar of democratic society.” Directly supports minimizing creator/poster/reader attribution.
- **Tor for Technologists**, **Privacy Enhancing Technologies (PETs)** — Fowler’s site covers anonymity and PETs (differential privacy, federated analysis, encrypted computation) for technologists.

**Medium**

- **Digital resistance (Hong Kong)** — Telegram, ProtonMail, Bridgefy/FireChat, Tor, VPN, burner phones, location privacy (What3Words). Reused in many protest contexts.
- **Signal, Threema, Briar** (e.g. Jose Saiz) — Standard secure-messaging recommendations for activists; Briar for offline/mesh.
- **Anti-doxing for activists** (Equality Labs) — Safety planning and digital security for activists facing harassment.
- **BitChat** — Offline BLE mesh messaging; useful for shutdowns/protests but treated as experimental until audited. Reinforces: web/link access without app install can reduce device fingerprinting (cf. StopICE).

**InfoQ**

- **Real-time event processing** — Decoupling, stream processing, failure isolation (e.g. DoorDash at scale, Kafka/ksqlDB). For our v1, simple poll or short-interval fetch of newest posts is enough; we don’t need event-stream infra for a single-channel feed.
- **Anonymous broadcast (academic)** — Riposte, Trellis, Echomix/Katzenpost, Waku: mix-nets, metadata privacy, million-user anonymity sets. We take a simpler approach: no identity stored or logged, rather than cryptographic anonymous broadcast.

**Stack Overflow / system design**

- **Riposte** (cited in academic/design contexts) — Anonymous broadcast with PIR/MPC, traffic-analysis resistance, million-user anonymity; multi-server. Our design favors “minimal data, no attribution” over full mix-net anonymity.
- **AnonymousOverflow** — Privacy frontend for Stack Overflow (no IP/fingerprint to SO). Example of reducing exposure of reader identity.

**Other US tools from research**

- **Comrad** (ComradOrg/Comrad, GitHub) — Encrypted, “insurveillable” social network for organizing; socialist/left organizing context.
- **March Hare Collective** — Crisis Map for actions, encrypted voice/chat (Operator Distribution), Dead Man’s Switch for remote wipe.
- **ICE Spotter** (saynotoice.com), **SignalSafe** (Migrant Insider) — Map-based ICE reporting; legal resources, hotlines.

**Takeaways for our design**

- **No app required** (web + link/QR) avoids IMEI/app-store tracking (StopICE). Our read path is web-only; no install.
- **Verification and criteria** for “observed” reports (ICEOut, Reddit) suggest optional moderation or clear posting guidelines, not necessarily in v1.
- **Privacy as democratic infrastructure** (Fowler) justifies strict no-attribution and no-identifying-logs policy.
- **Real-time** can be simple (polling newest-first); event-stream infra is optional later. **Anonymous broadcast** research (Riposte, Trellis) informs the threat model but we implement “minimal stored data” rather than mix-nets.

### Code samples and development strategies

Concrete patterns and references for implementing the broadcast feature, including from the BurnWare codebase and the cited projects.

**Post token (one-time secret for posting)**

- **Store only a hash of the token** so a DB leak does not reveal the secret. Return the raw token once at channel creation; caller must save it.
- **Stack Overflow** [“Generating one-time-only security tokens”](https://stackoverflow.com/questions/48171199/generating-one-time-only-security-tokens-from-uuid-or-hmac-jwt-hash): use cryptographically random bytes (e.g. `crypto.randomBytes(32)`), base64url-encode for URLs, store hash in DB; optional status (UNCLAIMED/CLAIMED) and expiry; background job to purge used/expired. Alternative: HMAC so verification doesn’t require storing the token (see [Rotational Labs HMAC verification tokens](https://rotational.io/blog/hmac-verification-tokens/)).
- **In-repo pattern (BurnWare):** [app/src/services/room-invite-service.ts](app/src/services/room-invite-service.ts) — `crypto.randomBytes(INVITE_TOKEN_LENGTH).toString('base64url')`, then `CryptoUtils.hash(token)`; store `invite_token_hash` in DB; verify with `CryptoUtils.hash(input.invite_token)`. Same pattern fits `broadcast_channels.post_token_hash`. [app/src/utils/crypto-utils.ts](app/src/utils/crypto-utils.ts) has `generateLinkToken` and hash helpers.

**Public read endpoint (no auth)**

- **Rate limit by IP** so one client can’t flood the feed. Don’t log IP or identifiers on this route (per our threat model).
- **In-repo pattern (BurnWare):** [app/src/middleware/rate-limit-middleware.ts](app/src/middleware/rate-limit-middleware.ts) — `threadViewRateLimiter` and `publicRateLimiter` use `express-rate-limit` with `windowMs`, `max`, `keyGenerator: (req) => req.ip`. Apply a similar limiter to `GET /api/v1/broadcast/:channel_id/posts`; use a per-IP window (e.g. 100–200 req/15 min) so reads are cheap but abuse is bounded. Skip or strip any logging that records IP for this handler.
- **Express-rate-limit:** [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) — `rateLimit({ windowMs, limit, standardHeaders: true })`; for multiple instances use a shared store (e.g. Redis).

**Pagination (newest first)**

- **Cursor-based:** `GET /posts?limit=50&before=<post_id>` — query `WHERE channel_id = $1 AND (created_at, post_id) < ($2, $3) ORDER BY created_at DESC LIMIT 50`. Index `(channel_id, created_at DESC)` (or `(channel_id, (created_at, post_id))`). First page: omit `before` or use a sentinel.
- **Offset-based** is simpler but can skip/duplicate if new posts arrive; cursor is preferred for a live feed.

**Front-end / API split (referenced projects)**

- **Cosecha/redadalertas:** React (Create React App) front end; separate API repo ([redadalertas-api](https://github.com/Cosecha/redadalertas-api)); Docker; wiki for structure. Strategy: decouple UI from API so backend can enforce auth and validation.
- **chinga-la-migra:** Front-end only; backend is a public REST API (e.g. mLab/MongoDB `GET`/`POST` on a `checkpoints` collection); [map-service.js](https://github.com/crashspringfield/chinga-la-migra/blob/master/js/map-service.js) holds API URLs. Strategy: “works with any backend”; for broadcast we own the API and avoid storing identity.

**Development strategy summary**

| Area | Strategy | Reference |
|------|----------|-----------|
| Post token | Generate crypto random, store SHA-256 hash only, return raw token once | BurnWare room-invite-service, Stack Overflow 48171199, crypto-utils |
| Read endpoint | No auth; rate limit by IP; do not log IP/identifiers | BurnWare rate-limit-middleware, express-rate-limit |
| Pagination | Cursor-based `before=<id>`; index (channel_id, created_at DESC) | Standard REST feed pattern |
| Channel ID | Short, URL-safe token (e.g. 12–16 chars); crypto random | BurnWare CryptoUtils.generateLinkToken |
| QR code | Encode read URL only; optional server-generated image (e.g. qr-code lib + S3 or response) | Design: link/QR shareable without app |

---

## Design options

### Option A: Dedicated broadcast tables (recommended)

- **`broadcast_channels`**  
  Like a link, but for broadcasting: `channel_id` (short token), `owner_user_id` (optional; null = fully anonymous channel), `display_name`, `created_at`, `expires_at`, `burned`. Optional: `post_token_hash` so an anonymous creator can post with a one-time token; optional `qr_code_url` (e.g. S3 or generated endpoint) so the read URL can be shared as a QR code. **`expires_at`** is nullable; `NULL` = no expiry (default). At creation time the creator can optionally set an expiry (e.g. none, 24h, 72h, 30d, 1y) for time-limited campaigns. A cleanup job can periodically purge channels where `expires_at < NOW()`.

- **`broadcast_posts`**  
  One row per message: `post_id`, `channel_id`, `content` (or `ciphertext` if you add optional channel-level encryption), `created_at`. **No contributor attribution:** no `sender_id`, no `sender_type`, no display name or identifier. Contributors are anonymous and hidden; readers and the platform cannot tell who wrote which post. Content is freeform (e.g. text describing a location and recent interaction); `created_at` gives recency. Optional later: structured location fields (e.g. lat/lng, place name) for map display.

**API (minimal):**

- `POST /api/v1/broadcast` (auth optional) — create channel; if no auth, return a **post token** (one-time secret) so the creator can post. Return the **read-only URL** (e.g. `https://app/b/:channel_id`) so the creator can share the channel via **link or QR code**. Optionally return a QR code image URL or endpoint for that URL so the creator can print or share a QR (e.g. for flyers). Optional body: `expires_at` or expiry preset (none, 24h, 72h, 30d, 1y).
- `POST /api/v1/broadcast/:channel_id/posts` — add a post (auth as owner **or** valid post token). Rate limit per channel.
- `GET /api/v1/broadcast/:channel_id/posts?limit=50&before=<post_id>` — **no authentication required**. Public; no login, account, or credentials. Paginated list of posts **newest first** (so readers see the most recent reports first—important for location/activity feeds). Anyone with the URL can read.
- `POST /api/v1/broadcast/:channel_id/burn` — burn the channel (requires post token). Channel stops serving; optionally purge or overwrite content per policy.

**Scale (millions of readers):**

- **No recipient table** — we never store who read what.
- **Read path**: single indexed query on `(channel_id, created_at DESC)` with `LIMIT`. Index: `(channel_id, created_at)`.
- **Caching**: Put CloudFront (or API Gateway + cache) in front of the GET endpoint; short TTL (e.g. 30–60 s) so viral traffic doesn’t hit the DB for every view.
- **Writes**: Rate limit posts per channel (e.g. 1 post/sec) so one channel can’t flood the DB.

### Option B: Reuse links + one thread per link

- Add `link_type` to `links`: `'inbox' | 'broadcast'`.
- For `link_type = 'broadcast'`: one **thread** per link (the “broadcast thread”); **messages** in that thread = broadcast posts. Only owner (or token holder) can add messages.
- **Read**: public endpoint `GET /api/v1/link/:link_id/broadcast` that returns messages for that link’s single thread (paginated).

**Pros:** Reuses existing schema and link UX (QR, short URL).  
**Cons:** Thread semantics are a bit overloaded; broadcast is “one thread, many messages” while inbox is “many threads, many messages.” Still workable.

### Option C: Anonymous-only broadcast (no owner account)

- Channel is created with a **create token** (long random string). Whoever has the token can post; no login.
- Read URL is separate (e.g. `https://app/b/:channel_id`). Only the create URL (with token) allows posting.
- Good for “I want to broadcast and never tie it to an account.”

---

## Use case: politically oppressive regimes

When the goal is to protect people under repressive governments, **attribution is the main risk**. The following design choices reduce the chance that the platform (or anyone who compels it) can identify creators, posters, or readers.

### Creator and contributor anonymity (contributors hidden)

- **Anonymous-by-default channels.** Do **not** require an account to create a channel. Creation returns a **post token** (long, unguessable). Whoever holds the token can post; no login, no email, no phone. The token can be shared among a group; we still never store or expose who posted what.
- **Contributors are anonymous and hidden.** Do not store or display any per-post attribution: no usernames, no “posted by,” no sender_id or sender_type. Readers see only the feed of posts; the platform has no data that identifies which person wrote which post. One channel can have multiple contributors (same token shared); all remain unidentifiable.
- **No `owner_user_id` for broadcast** (or keep it strictly optional and clearly “low-risk only”). For high-risk deployments, never store a link between a channel and a Cognito/user identity. If you don’t store it, you can’t hand it over.
- **Post token is the only secret.** Treat it like a burn-after credential: share only over a secure channel; if compromised, burn the channel and create a new one. No “forgot post token” recovery that involves email/SMS—that would create an identity link.

### Reader safety

- **No subscriber list, read receipts, or analytics.** We never store who read what. The read URL is the same for everyone; visiting it doesn’t create a record.
- **No server-side logging of readers.** For the public read endpoint, do not log IP, User-Agent, or request IDs. If you don’t log it, you can’t be forced to produce it. (Generic request counts for ops are OK; avoid anything that could identify individuals.)
- **Cache aggressively.** CloudFront (or similar) in front of the read endpoint means many reads are served from the edge. Traffic to origin is blended; harder to tie a specific request to a specific user.

### Creator/poster request handling

- **Do not log IP or identifying headers** for channel creation or post submission. If your stack normally logs these, exclude broadcast routes or strip identifiers before logging. Same principle: minimize what could be subpoenaed or leaked.

### Persistent by default; burn when creator chooses

- **Default to no expiry** (or long expiry, e.g. 1 year). The channel stays up until the creator burns it or optionally sets an expiry. Short expiry (e.g. 24–72h) is an **optional** choice for creators who want a one-off, time-limited broadcast.
- **One-click burn.** Creator (with post token) can burn the channel when they decide to limit exposure (e.g. before travel, after an op). Burn is **creator-controlled**, not automatic. When burned, the channel stops serving and, if policy allows, content can be purged or overwritten.

### What this does *not* do

- **Censorship resistance:** We are not (in this design) addressing regime-level blocking (e.g. domain block, national firewall). That would require Tor, alternative domains, or other infrastructure. We *do* avoid storing data that makes it easy to target or identify users.
- **E2EE:** End-to-end encryption of the feed to “millions” is complex (key distribution, rotation). For v1, plaintext or server-side encryption at rest is simpler; the main gain here is **no attribution**, not channel confidentiality. If the channel URL leaks, content is readable—so creators should treat the read URL as shareable but the post token as secret.

### Summary for high-risk deployment

| Principle | Implementation |
|-----------|----------------|
| No creator identity | Anonymous channel creation only; post token is sole auth. No `owner_user_id`. |
| No contributor identity | Contributors anonymous and hidden; no per-post attribution. Post only with post token; no account. No IP/identifying logs for create or post. |
| No reader identity | No subscriber table; no read logging that identifies users. |
| Minimal data | Channel + posts + expiry only. Persistent or long-lived by default; burn and optional short TTL when creator chooses. |
| Subpoena-resistant | Design so that even with legal compulsion, the platform has nothing that identifies who created, posted, or read. |

---

## Recommendations

1. **Start with Option A** (dedicated tables). Clear separation, easy to reason about and scale; you can always add “broadcast link” UX that creates a channel and shows a QR code.
2. **Anonymous-only by default for broadcast.** No account required to create or post; post token only. Omit `owner_user_id` (or make it optional and documented as non–high-risk only).
3. **No E2EE for v1** for the broadcast feed itself. Focus on no attribution; plaintext or server-side encryption at rest is acceptable. You can add a shared channel key later if needed.
4. **No identifying logs** for broadcast create, post, or read endpoints. Exclude these routes from any logging that captures IP, User-Agent, or session identifiers.
5. **Rate limiting**: per-channel post rate limit; global rate limit on channel creation. Use rate limits that don’t require storing per-user state (e.g. per channel_id or per IP with no long-term retention).
6. **Expiry and burn**: **persistent by default** (nullable or long `expires_at`); one-click burn with post token when creator wants to kill the channel; optional short expiry for time-limited use. Purge or overwrite when burned if policy allows.

---

## Summary

| Question              | Answer                                                                 |
|-----------------------|------------------------------------------------------------------------|
| Who can post?         | Anyone with the **post token** (no account). Contributors are anonymous and hidden; no names or attribution. Channel is persistent. |
| Who can read?         | Anyone with the read URL; no account, no identity stored, no read logging. |
| How to scale reads?   | No recipient table; index on (channel_id, created_at); cache GET.     |
| How to keep it safe?  | No creator/poster/reader identity stored or logged; persistent channel by default; burn with token when creator chooses. |

This gives you a **broadcast** product that fits BurnWare (short URLs, optional expiry, burn) and is suitable for high-risk environments: persistent by default so the link can be disseminated to millions, while even if the platform is seized or compelled it holds no data that identifies who created, posted, or read.

---

## Integration with the existing app

### Owner-created broadcast from the dashboard

A natural way to integrate is to let an **authenticated owner** create a broadcast channel from the dashboard, similar to how they create inbox links today:

- **Dashboard:** Add a "Broadcast" (or "Channels") section alongside **Links** and **Rooms**. Owner clicks "Create broadcast channel," enters a display name, and the backend creates a channel and returns:
  - **Read URL** — e.g. `https://dev.burnware.live/b/abc123` (what the public uses to view the feed).
  - **Post token** — secret used only to add posts or burn the channel (stored by the owner; e.g. in the UI or copied once).
  - **QR code** — encode the **read URL** so the owner can print or share it (flyers, community centers, etc.).
- **List "My broadcast channels":** If we store `owner_user_id` on the channel (optional in schema), the dashboard can list the owner’s channels. Each row shows the channel name, read URL (copy), QR (for the read URL), and a way to "Add post" (using the post token) or "Burn channel." If we omit `owner_user_id` for high-risk, there is no list—the owner must save the read URL and post token themselves after creation.
- **Trade-off:** Storing `owner_user_id` gives a familiar dashboard experience (create → see in list → share link/QR) but links the channel to the account. For the US community-alert use case, many deployments will accept that; for maximum anonymity, support both "create from dashboard (with list)" and "create anonymously (no list, no account)."

### How the channel is "broadcasted"

The channel is broadcast by **sharing the read URL** (or a QR code that points to it):

- Owner (or whoever has the post token) **copies the read URL** and pastes it anywhere—Signal, flyers, another app—or **shows/prints a QR code** that encodes that same URL.
- **Anyone** who gets the link (or scans the QR) opens it in a browser. They go to `https://dev.burnware.live/b/abc123`, **no login required**, and see the feed of posts (newest first).
- So "broadcast" = one stable, public link (and its QR) that many people can use to read. The same pattern as the existing app: for **inbox** links you share the *send* URL (e.g. `/l/:linkId`) so people can send you messages; for **broadcast** you share the *read* URL (`/b/:channelId`) so people can read the feed.

Reuse the existing **QRCodeDialog** pattern: for a broadcast channel, the dialog would show the **read** URL and a QR for that URL (e.g. `QRCodeSVG value={readUrl}`), plus "Copy link" and "Download QR," same as for links. The only difference is the URL is the public feed URL, not the send-message URL.

### Can the existing chat room design be adapted?

**Rooms** are built for **multi-party chat**: invites, join flow, participants (max 10), E2EE group keys, per-participant state. Broadcast is **one-to-many**: one feed, no participant list, no join, no keys. So the room schema and flow don’t map cleanly:

- We’d have to drop invites (or treat "the read URL" as the only "invite"), drop participant list and approval, and either drop E2EE for the feed or invent a single shared key. The result would be a different product with the same table name. **Recommendation:** don’t adapt rooms; add a dedicated broadcast path (tables or link type below).

**Two implementation options that fit the existing app:**

| Option | Description | Dashboard integration |
|--------|-------------|------------------------|
| **A. Dedicated broadcast tables** | `broadcast_channels` and `broadcast_posts` as in the design. | New "Broadcast" section in the dashboard. "Create broadcast channel" → list of channels (if `owner_user_id` is set) with read URL, QR, post token, add post, burn. Same QR dialog pattern as links, but for the read URL. |
| **B. Broadcast as a link type** | Add `link_type` to `links`: `'inbox' \| 'broadcast'`. One **thread** per broadcast link; **messages** in that thread = broadcast posts (only owner or post-token can add; no sender attribution in UI). Read URL: `/b/:link_id`. | Reuse **Links** list: "Create link" could offer "Inbox" vs "Broadcast." Broadcast links appear in the same buddy list with a different icon or section. Clicking a broadcast link opens a channel view: read URL, QR for read URL, feed of posts, "Add post" (with token). Fewer new screens; reuses link creation and QR dialog. |

**Recommendation:** **Option A** (dedicated tables) keeps the model clear (channel + posts, no thread/sender_type reuse) and makes it obvious that readers see a single feed with no attribution. **Option B** reuses links and threads and fits the existing "link" mental model (owner has a list of links; one type is inbox, one is broadcast) but requires care: use only `sender_type = 'owner'` (or null) for broadcast-thread messages and never show sender in the feed UI.

Either way, the **broadcast flow** is: owner creates a channel (or broadcast link) → gets read URL + post token + QR for read URL → shares that link/QR with the public → public views at the read URL with no login; contributors post using the post token.

---

## Next steps (deploy to dev.burnware.live)

**Deployment target:** All new work must ship to **dev.burnware.live** (dev environment). Use `--context environment=dev` for CDK; frontend and API are served from the existing dev stacks.

**Implementation order:**

1. **Database migration**  
   Add `database/migrations/004_broadcast.sql`: tables `broadcast_channels` (channel_id, post_token_hash, display_name, created_at, expires_at, burned, optional qr_code_url), `broadcast_posts` (post_id, channel_id, content, created_at). Index `(channel_id, created_at DESC)`. No owner_user_id for high-risk; expires_at nullable.

2. **Backend (app/)**  
   - **Models:** `BroadcastChannelModel`, `BroadcastPostModel` (create, get by id, list posts with cursor pagination, burn channel).  
   - **Service:** `BroadcastService` — create channel (generate short channel_id, crypto random post token, store hash, return read URL + post token); add post (verify post token hash); list posts (newest first, cursor); burn (verify post token, set burned).  
   - **Controller:** create channel (no auth), add post (body: post_token + content), get posts (no auth, pagination), burn (body: post_token).  
   - **Routes:** `POST /api/v1/broadcast`, `POST /api/v1/broadcast/:channel_id/posts`, `GET /api/v1/broadcast/:channel_id/posts`, `POST /api/v1/broadcast/:channel_id/burn`.  
   - **Rate limiting:** Apply a read-only rate limiter (e.g. by IP, no identifier logging) to the GET posts route; exclude broadcast routes from any middleware that logs IP/identifiers.  
   - **Validators:** Joi schemas for create channel, add post, burn.  
   Wire routes into [app/src/routes/index.ts](app/src/routes/index.ts) and public routes where appropriate (create + read public; post/burn with token).

3. **Frontend**  
   - **Public read page:** Route `/b/:channelId` — fetch `GET /api/v1/broadcast/:channelId/posts`, render newest-first feed; no auth.  
   - **Create flow (minimal):** Page or modal that calls `POST /api/v1/broadcast`, displays read URL and post token (and optional QR for read URL); copy link / show QR.  
   - **API endpoints:** Add `public.broadcastPosts(channelId)`, `public.broadcastCreate()`, etc. in [frontend/src/config/api-endpoints.ts](frontend/src/config/api-endpoints.ts).  
   Use existing frontend stack so the app is available at **https://dev.burnware.live** (including `/b/:channelId`).

4. **Run migration and deploy to dev**  
   - Run migration against dev RDS (via bastion, SSM, or your usual migration path).  
   - Deploy backend: `cd app && npm run build` then deploy via CodeDeploy / your pipeline, or `cdk deploy BurnWare-App-dev --context environment=dev` to update app stack.  
   - Deploy frontend: `cd frontend && npm run build` then upload to dev S3 / invalidate CloudFront, or use your existing Frontend stack deploy so **https://dev.burnware.live** serves the new build.  
   - Verify: Create a channel at dev, open read URL in incognito (no auth), add a post with token, confirm feed updates.

5. **Optional follow-ups (after v1 on dev)**  
   - Optional expiry at create (none / 24h / 72h / 30d).  
   - Optional QR code generation (e.g. `qr-code` lib, return as URL or inline image).  
   - CloudFront cache rules for `GET /api/v1/broadcast/:id/posts` (short TTL).  
   - Cleanup job for channels with `expires_at < NOW()`.
