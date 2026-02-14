# Room Feature — GitHub / Open-Source Pattern Research

This doc maps the BurnWare room pattern (E2EE group chat, invite tokens, approval, creator-wraps-group-key-per-participant) to similar patterns in public GitHub repos and specs.

---

## 1. Pattern: “Wrap group key per participant” (ECDH + symmetric group key)

**BurnWare:** Creator has a shared AES group key + room ECDH key pair. Creator wraps the group key for each participant using ECDH (room private + participant public) and sends the wrapped key via API. Participant unwraps with their private + room public.

**GitHub / specs that use a similar idea:**

| Source | Pattern | Link |
|--------|--------|------|
| **ssbc/ssb-private-group-keys** | “SecretKey” for group/message key; “poBoxKey(x_dh_secret, x_dh_public, x_id, y_dh_public, y_id) => { key, scheme }” — DH shared key per recipient; “Create a shared key for communication between your feed and another feed.” | [GitHub](https://github.com/ssbc/ssb-private-group-keys) |
| **AWS Encryption SDK** | Raw ECDH keyrings: “RawPrivateKeyToStaticPublicKey” — sender private + recipient static public → ECDH → KDF → wrapping key; used to encrypt data keys per recipient. | [AWS Raw ECDH](https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/use-raw-ecdh-keyring.html) |
| **Matrix Megolm** | Group ratchet: each sender has an outbound session; “session data is shared with other participants via a **secure peer-to-peer channel** (e.g. Olm).” Session/ratchet is the “group key” shared per participant over Olm. | [Megolm spec](https://spec.matrix.org/unstable/olm-megolm/megolm/) |
| **@chatereum/react-e2ee** (npm) | Hybrid: symmetric key encrypts data; “expose AES key components that you can **wrap per recipient** with their public key.” | [npm](https://www.npmjs.com/package/@chatereum/react-e2ee) |

**Takeaway:** “One symmetric group key, wrap it per participant with ECDH (or similar)” is a common pattern; SSBC and AWS show the DH wrap step; Matrix uses a different (ratchet) group key but still “share session with each participant over a secure channel.”

---

## 2. Pattern: Sender keys / group key distribution (Signal-style)

**BurnWare:** Single shared group key; creator distributes it by wrapping once per participant. No per-sender ratchet.

**GitHub:**

| Source | Pattern | Link |
|--------|--------|------|
| **signalapp/libsignal** | **Sender keys:** “SenderKeyDistributionMessage” — sender creates a sender key state and distributes it; “process_sender_key_distribution_message” stores it per sender. Group cipher encrypts with sender’s chain key; recipients need that sender’s key state. | [group_cipher.rs](https://github.com/signalapp/libsignal/blob/main/rust/protocol/src/group_cipher.rs) |
| **Signal Desktop** | Group handling (members, keys, etc.) in TypeScript. | [ts/groups.ts](https://github.com/signalapp/Signal-Desktop/blob/main/ts/groups.ts) |

**Takeaway:** Signal uses per-sender keys (sender keys) and distribution messages; BurnWare uses one group key wrapped per participant. Both are “distribute key material so only intended participants can decrypt.”

---

## 3. Pattern: Invite / join approval and one-time tokens

**BurnWare:** One-time invite token in URL; join with token + public key; creator approves (or auto-approve); then creator distributes wrapped group key.

**GitHub / references:**

| Source | Pattern | Link |
|--------|--------|------|
| **chitchatter** | OTP/invite: “secure-invite flow using **one-time links**; sharer generates `/otp/:id` link, must keep tab open until sharee accepts; sharer is auto-redirected when invite is accepted.” | [OTP feature issue](https://github.com/jeremykahn/chitchatter/issues/2) (summary from search) |
| **Teleport** | Join tokens: “Token resource specifies allowed join methods; tokens are **exchanged for certificates** when a node joins; possession of token can allow join.” | [Join Methods and Tokens](https://goteleport.com/docs/reference/join-methods) |
| **GitHub org invites** | Invite by link/email; invitee clicks to join; **expiry** (e.g. 7 days) and **rate limits** (e.g. 50/24h). | [GitHub Docs](https://docs.github.com/en/organizations/managing-membership-in-your-organization/inviting-users-to-join-your-organization) |

**Takeaway:** One-time or short-lived invite tokens + “creator keeps tab open until accepted” / “exchange token for membership” are common; BurnWare’s invite-token + approval + key distribution fits that family.

---

## 4. Pattern: Sharing session/group key “via secure channel”

**BurnWare:** Wrapped group key is sent over HTTPS to the backend; participant polls status and receives `wrapped_group_key` when creator has called set-key. Channel is server-mediated but payload is E2EE (server can’t unwrap).

**Specs:**

| Source | Pattern | Link |
|--------|--------|------|
| **Matrix Megolm** | “Session data is shared with other participants in the conversation via a **secure peer-to-peer channel** (such as Olm).” “Dependency on secure channel for key exchange” is explicit. | [Megolm spec](https://spec.matrix.org/unstable/olm-megolm/megolm/) |
| **Netflix MSL** | Authenticated DH: “include the party’s **public key** in the key-request payload”; mechanisms (PSK/MGK/WRAP) for authenticated key exchange. | [Netflix MSL wiki](https://github.com/Netflix/msl/wiki/Authenticated-Diffie-Hellman-Key-Exchange) |

**Takeaway:** “Share group/session key over a secure (or authenticated) channel” is standard; BurnWare uses server as carrier for wrapped keys, with security coming from E2EE (only participant can unwrap).

---

## 5. Summary: How BurnWare maps to these patterns

| BurnWare piece | Closest GitHub/spec pattern |
|----------------|-----------------------------|
| One AES group key | SSBC SecretKey / Matrix session key / symmetric “data key” in hybrid schemes |
| Wrap group key per participant (ECDH) | SSBC poBoxKey/directMessageKey; AWS Raw ECDH keyring; “wrap per recipient” in react-e2ee |
| Invite token + join + approval | Chitchatter OTP one-time link; Teleport join token; GitHub org invite flow |
| Creator distributes keys after approval | Megolm “share session with participants via secure channel”; Signal “sender key distribution message” (different key model) |
| Participant polls for `wrapped_group_key` | “Key distribution” / “session sharing” step in group E2EE; often done over existing secure channel (Olm, etc.) |

---

## 6. Repos worth a closer look

- **ssbc/ssb-private-group-keys** — DH-based shared key per feed/recipient; good reference for “one key, derive per party.”
- **signalapp/libsignal** — `group_cipher.rs`, `process_sender_key_distribution_message`, `create_sender_key_distribution_message` — reference for group key distribution and state.
- **Matrix Megolm spec** — Session setup, “sharing session data” with other participants, and dependency on secure channel.
- **alexkorep/e2e-encrypt-chat**, **revanp/e2ee-chat** — React + E2EE chat examples (different key models but useful for UX/flow).

---

*Research for BurnWare room feature; patterns compared to public GitHub repos and specs (2024–2025).*
