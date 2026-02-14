# Broadcast on Dev – Deployment Troubleshooting

## "API returned HTML" / "Invalid response from server"

If the dashboard shows errors like **"Failed to create channel"** or **"API unreachable"** and the browser console shows **"Unexpected API response: <!DOCTYPE html>..."**, the frontend is receiving the SPA’s `index.html` instead of JSON from the API.

### Cause

Requests to `/api/v1/*` are going to the **SPA origin** (CloudFront → S3) instead of the **backend** (CloudFront → ALB). When the path doesn’t exist on S3, CloudFront returns the error document (`index.html`), so the client gets HTML instead of JSON.

### Fix

CloudFront must have a **behavior that routes `/api/*` to the ALB**.

1. **Confirm the Frontend stack was deployed with the ALB**
   - In `bin/burnware.ts`, the Frontend stack is created with `alb: appStack.alb`.
   - The Frontend stack only adds the `/api/*` behavior when `alb` is provided.

2. **Check CloudFront behaviors**
   - AWS Console → **CloudFront** → your distribution (e.g. for dev.burnware.live).
   - Open the **Behaviors** tab.
   - You should see a behavior with path pattern **`/api/*`** and origin = **VPC origin (ALB)**.
   - If it’s missing, the Frontend stack was likely deployed without the App stack’s ALB (or before the ALB existed).

3. **Redeploy the Frontend stack**
   - Redeploy so the `/api/*` behavior is created:
     ```bash
     cdk deploy BurnWare-Frontend-dev --context environment=dev
     ```
   - Ensure the **App** stack is already deployed (so `appStack.alb` exists and is passed into the Frontend stack).

4. **After redeploy**
   - Wait for CloudFront to finish deploying, then try creating a broadcast channel again.
   - The frontend will now show a clearer toast (**"API unreachable. On dev, ensure CloudFront routes /api/* to your backend..."**) when this misconfiguration is detected.
