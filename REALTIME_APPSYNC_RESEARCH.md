# Real-Time Messaging (AppSync Events) — Research Summary

Summary of online research and AWS docs used to implement and troubleshoot BurnWare’s real-time message delivery.

## References

- [What is AWS AppSync Events?](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html)
- [Understanding the Event API WebSocket protocol](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html)
- [Understanding channel namespaces](https://docs.aws.amazon.com/appsync/latest/eventapi/channel-namespaces.html)
- [Configuring authorization (API key, IAM, etc.)](https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html)
- [Building real-time apps with AppSync Events (blog)](https://aws.amazon.com/blogs/mobile/building-real-time-apps-with-aws-appsync-events-websocket-publishing/)

---

## Protocol Checklist (Why Real-Time Might Not Work)

1. **Connection**
   - Connect to `wss://{realtimeDns}/event/realtime`.
   - Use subprotocols: `aws-appsync-event-ws` and `header-{base64url(auth)}`.
   - For **API key**, auth object must be **only** `host` (HTTP endpoint) and `x-api-key`. Extra fields (e.g. `x-amz-date`) are for IAM and can cause subscribe/connect issues; we use API key only in the browser.

2. **Initialization**
   - Optionally send `connection_init`, then **wait for `connection_ack`** (includes `connectionTimeoutMs`).
   - Only after `connection_ack` should the client send `subscribe` messages.

3. **Subscribe**
   - Message: `{ type: "subscribe", id: "<unique-id>", channel: "/namespace/...", authorization: { host, "x-api-key" } }`.
   - Channel path: **first segment must match a defined namespace**. We use namespace `messages` and channels `/messages/thread/{id}` and `/messages/link/{id}`.
   - Each segment: up to 50 alphanumeric + dash; case-sensitive. We normalize link IDs (base64url) by replacing `_` with `-`.

4. **Confirmation**
   - Wait for `subscribe_success` per subscription before assuming events will be delivered.
   - On `subscribe_error`, check channel format and authorization.

5. **Keep-alive**
   - AppSync sends `"ka"` periodically (~60s). If no `ka` within `connectionTimeoutMs` (e.g. 5 min), client should close and reconnect with jittered exponential backoff.

6. **Publishing (backend)**
   - Publish via HTTP: `POST https://{httpDns}/event` with `x-api-key` and body `{ channel, events: [stringified JSON, ...] }` (up to 5 events per request).
   - Channel must belong to a defined namespace; same path rules as subscribe.

---

## Common Causes for “No Real-Time”

| Symptom | Likely cause | What to check |
|--------|---------------|----------------|
| No WebSocket at all | AppSync not configured in frontend | Console: “[BurnWare] Real-time disabled”. Ensure `runtime-config.json` is deployed and loaded, or set `VITE_APPSYNC_*` in `frontend/.env` for local dev. |
| Connect then nothing | Subscribe auth wrong or channel wrong | We use **only** `host` + `x-api-key` in subscribe `authorization` (no `x-amz-date`). Channel must be `/messages/thread/{id}` or `/messages/link/{id}` (namespace `messages`). |
| subscribe_error in console | Channel format or auth rejected | Channel: leading slash, segments [A-Za-z0-9-], max 5 segments. Link IDs: replace `_` with `-`. |
| Connected + subscribe_success but no events | Backend not publishing | Server logs: “AppSync Events disabled” or “AppSync publish failed”. Set `APPSYNC_HTTP_DOMAIN` and `APPSYNC_API_KEY` on the API process (e.g. EC2 user-data from App stack). |
| Config change not taking effect | AppSync propagation delay | AWS may serve previous config briefly after API changes. Wait a few minutes and retry. |

---

## Configuration Flow in BurnWare

- **Deployed frontend**: `runtime-config.json` is deployed to S3 with `appSync: { httpDns, realtimeDns, apiKey }`. The SPA fetches it at load (`loadRuntimeConfig()` in `main.tsx`) so no build-time secrets are needed.
- **Local frontend**: Set `VITE_APPSYNC_HTTP_DOMAIN`, `VITE_APPSYNC_REALTIME_DOMAIN`, and `VITE_APPSYNC_API_KEY` in `frontend/.env` (values from AppSync stack outputs or the deployed `runtime-config.json`).
- **Backend**: App stack passes AppSync outputs into EC2 user-data as `APPSYNC_HTTP_DOMAIN` and `APPSYNC_API_KEY`. For local API (`npm run dev` in `app/`), set those env vars there too.

---

## Implementation Notes

- **Single WebSocket**: One shared connection for all subscriptions (per AWS guidance).
- **Debounce**: Event callback is debounced (~280 ms) so rapid events trigger one refetch.
- **Diagnostics**: Console messages prefixed `[BurnWare]` indicate config load, connection, subscribe, and first event received.
