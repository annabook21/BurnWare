# Frontend Plan Review – Best Practices vs Plan & Implementation

This document summarizes **internet-researched best practices** for the languages and methods used by the BurnWare frontend, then reviews the **AIM Design Plan** and **current implementation** against them.

**Stack:** React 18, TypeScript, Vite 6, React Router v6, styled-components 6, 98.css, Howler, react-draggable, Amazon Cognito, Axios.

---

## 1. Research: Best Practices by Technology

### 1.1 React 18 + TypeScript

**Sources:** [React 18 Upgrade Guide](https://legacy.reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html), [TypeScript Best Practices for React](https://www.congdinh.com/en/blog/typescript-best-practices), [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).

- **Entry point:** Use `createRoot` (not `ReactDOM.render`). ✅ *Implementation uses `ReactDOM.createRoot` in `main.tsx`.*
- **Project structure:** Prefer `components/`, `hooks/`, `pages/`, `types/`, `utils/` (or `context/`). ✅ *Plan and implementation follow this; no dedicated `types/` folder yet.*
- **Props:** Use interfaces/types (`ComponentNameProps`), avoid `any`, use union types for variants. Plan’s examples use typed props. ✅
- **Concurrent features:** React 18’s automatic batching and concurrent rendering work without code changes. No plan update needed.

**Recommendation:** Add a `src/types/` folder for shared types (e.g. `Link`, `Message`, `Thread`) to keep types reusable and co-located.

---

### 1.2 Vite + Production Build

**Sources:** [Vite Building for Production](https://vite.dev/guide/build), multi-environment React + S3/CloudFront patterns.

- **Build:** Use `vite build` for production; do not run the dev server in production. ✅ *README and scripts use `npm run build` (tsc + vite build).*
- **Base path:** If the app is served under a subpath (e.g. `https://cdn.example.com/app/`), set `base: '/app/'` in `vite.config.ts`. *Currently not set; fine for root deployment at CloudFront.*
- **Source maps:** Optional in production (security/size). Plan doesn’t specify; current config has `sourcemap: true`. Consider `sourcemap: false` or hidden source maps for production.
- **Legacy browsers:** Use `@vitejs/plugin-legacy` only if you need to support older browsers; adds polyfills and extra chunks. Plan targets “desktop-first”; current target ES2020 is reasonable.

**Recommendation:** Document in the plan that production builds should use `base` when deploying under a subpath, and consider toggling source maps by environment.

---

### 1.3 Styled-Components

**Sources:** [styled-components FAQ](https://styled-components.com/docs/faqs), [Josh W. Comeau – styled-components](https://www.joshwcomeau.com/css/styled-components/), [Measuring styled-components performance](https://useanvil.com/blog/engineering/react-styled-components-best-practices).

- **Dynamic styles:** Prefer CSS variables or `attrs` for dynamic values to avoid regenerating classes on every prop change. Plan’s `MessageBubble` uses `props.isOwner` in template literals; that can cause extra style recalc.
- **Theme:** Use a single `ThemeProvider` and theme object. ✅ *App.tsx uses `ThemeProvider` and `aimTheme`.*
- **Reuse:** Use the `css` helper for shared style fragments; keep components under 500 lines. Plan already keeps files small. ✅
- **v6:** Styled-components v6 is TypeScript-native and drops unnecessary vendor prefixes. ✅ *Implementation uses v6.*

**Recommendation:** In the plan, add a short “Performance” note: for frequently re-rendered styled components with dynamic props (e.g. message bubbles), prefer theme CSS variables or `attrs` instead of interpolated props where possible.

---

### 1.4 React Router v6 (SPA)

**Sources:** [React Router v6 SPA](https://reactrouter.com/how-to/spa), [React Router v6 Docs](https://reactrouter.com/v6).

- **SPA:** All routes must serve the same `index.html` (no server-side routing). ✅ *CDK Frontend stack already configures CloudFront error responses 404/403 → 200 with `index.html`.*
- **Data loading:** For SPA-only, use client-side loaders/state (no `react-router.config.ts` required for a simple SPA). Current app uses client state and effects. ✅
- **SSR-safe:** If you ever pre-render, avoid `window`/browser APIs during initial render. Plan doesn’t assume SSR; fine for current SPA.

**Recommendation:** In the plan, explicitly state that the SPA is client-only and that CloudFront is configured to serve `index.html` for all paths (already true in CDK).

---

### 1.5 Environment Variables & S3/CloudFront

**Sources:** [Deploy React SPA to S3 and CloudFront](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html), [Multi-environment React on S3/CloudFront](https://www.cloudthat.com/resources/blog/building-multi-environment-react-deployments-with-amazon-s3-and-amazon-cloudfront/), AWS Q&A on CloudFront vs API URL.

- **Static hosting:** S3 cannot run server-side code; env vars must be baked in at **build time**. ✅ *Vite’s `VITE_*` vars are inlined at build.*
- **Do not commit `.env`:** Use `.env.example` and inject real values in CI/CD. ✅ *README and `.env.example` align with this.*
- **API base URL:** Must point at the **API (e.g. ALB)**, not the CloudFront distribution URL. ✅ *`aws-config.ts` uses `VITE_API_BASE_URL`; README says to set it to the API endpoint.*

**Recommendation:** In the plan (or README), add one sentence: “Set `VITE_API_BASE_URL` to the API endpoint (e.g. ALB URL), not the CloudFront domain.”

---

### 1.6 Cognito / Auth

**Sources:** [Amplify Auth vs Cognito Identity JS](https://www.npmjs.com/package/amazon-cognito-identity-js), [Authenticate React users with Cognito and Amplify UI](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/authenticate-react-app-users-cognito-amplify-ui.html).

- **Library:** AWS recommends **Amplify JavaScript Auth** over `amazon-cognito-identity-js` for new apps (modern API, tree-shaking, typings). Current implementation uses `amazon-cognito-identity-js`. ✅ Works; migration is optional.
- **Tokens:** Both store tokens in localStorage by default; XSS can expose them. Plan doesn’t discuss token storage; consider documenting that and any future hardening (e.g. httpOnly cookies if you move to a backend-proxy auth flow).

**Recommendation:** In the plan, add a “Future consideration” note: “For new greenfield apps, AWS recommends Amplify Auth; current app uses amazon-cognito-identity-js and can be migrated later if desired.”

---

### 1.7 Accessibility (A11y)

**Sources:** [W3C ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/), [React Accessibility (BrowserStack)](https://www.browserstack.com/guide/react-accessibility), [MDN ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role).

- **Semantic HTML:** Use `<button>`, `<nav>`, headings, etc., instead of clickable `<div>`s. Plan mentions “Proper ARIA labels despite retro styling.” ✅
- **ARIA:** Use `aria-label`, `aria-labelledby`, `aria-pressed` where semantic HTML isn’t enough; prefer native elements over `role="button"` on divs (to get keyboard/focus for free).
- **Keyboard:** All interactive elements must be keyboard-accessible. Plan: “Full keyboard support for window management.” ✅
- **Focus:** Visible focus indicators and logical focus order. Plan: “Proper focus handling for multiple windows.” ✅
- **Contrast:** “Ensure text readable despite nostalgic colors.” ✅

**Recommendation:** In the plan’s “Accessibility” subsection, add a bullet: “Use semantic elements (`<button>`, `<dialog>`, etc.) first; add ARIA only when necessary, following the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).”

---

### 1.8 Window Management (react-draggable vs react-flexi-window)

**Plan:** Originally specified `react-flexi-window` (draggable + resizable).  
**Implementation:** Uses `react-draggable` (draggable only). No `react-flexi-window` in `package.json`.

- Both are valid. `react-draggable` is widely used and lightweight; resizing can be added later if needed.
- **Recommendation:** Update the plan (e.g. in “Technology Stack” and “Package Dependencies”) to state that **react-draggable** is used for window dragging; optionally note that resizing can be added later with a separate library or custom logic.

---

## 2. Plan vs Implementation Gaps

| Plan item | Implementation | Status |
|-----------|----------------|--------|
| react-flexi-window | react-draggable | ✅ Intentional swap; update plan text. |
| useDraggable hook | Not present | Either add or remove from plan. |
| useBuddyStatus hook | Not present | Either add or remove from plan. |
| MessagesView.tsx | Not as separate file; may be inlined in ThreadsPanel/ChatWindow | Verify and align plan. |
| LinkMetadataDisplay.tsx | Not in file list | Plan lists it; implementation may use QRCodeDialog or similar. |
| sound-utils.ts | Not in file list | Only useAIMSounds.ts. Plan lists both; align. |
| types/ folder | Not present | Recommended for shared types. |
| 500-line lint script | Present as `lint:file-size` | ✅ Matches plan. |

---

## 3. Recommendations Summary

### 3.1 Update the plan (AIM_DESIGN_PLAN.md)

1. **Technology stack:** Replace `react-flexi-window` with **react-draggable**; note that resizing can be added later.
2. **Package dependencies block:** Update the JSON example to match current `package.json` (react-draggable, current versions).
3. **Performance (styled-components):** Add a short note on using CSS variables or `attrs` for dynamic styled-components to reduce re-renders.
4. **Deployment:** State that CloudFront is configured to serve `index.html` for all SPA paths; set `VITE_API_BASE_URL` to the API endpoint, not CloudFront.
5. **Accessibility:** Add reference to W3C ARIA APG and “semantic HTML first, ARIA when needed.”
6. **Cognito:** Add a “Future consideration” about Amplify Auth for new apps.
7. **Hooks/utils:** Either remove references to `useDraggable`, `useBuddyStatus`, `sound-utils.ts`, and `MessagesView.tsx`/`LinkMetadataDisplay.tsx` or add them to the implementation roadmap.

### 3.2 Implementation / repo

1. **package.json:** Fix JSON syntax (missing comma after `engines`). ✅ *Fixed in this pass.*
2. **Vite:** Consider `base` in config when deploying under a subpath; consider disabling or restricting source maps in production.
3. **Types:** Introduce `src/types/` and move shared interfaces (Link, Message, Thread, etc.) there for reuse and clarity.
4. **Styled-components:** In hot-path components (e.g. message list items), prefer theme-based CSS variables or `attrs` for dynamic values where it’s easy to do so.

---

## 4. References Used

- React 18 Upgrade Guide: https://legacy.reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html  
- React 19 Upgrade Guide: https://react.dev/blog/2024/04/25/react-19-upgrade-guide  
- TypeScript Best Practices (React): https://www.congdinh.com/en/blog/typescript-best-practices  
- Vite Building for Production: https://vite.dev/guide/build  
- Styled-components FAQ: https://styled-components.com/docs/faqs  
- Josh W. Comeau – styled-components: https://www.joshwcomeau.com/css/styled-components/  
- React Router v6 SPA: https://reactrouter.com/how-to/spa  
- Deploy React SPA to S3 and CloudFront (AWS): https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html  
- amazon-cognito-identity-js (npm): https://www.npmjs.com/package/amazon-cognito-identity-js  
- Authenticate React users with Cognito and Amplify: https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/authenticate-react-app-users-cognito-amplify-ui.html  
- W3C ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/  
- React Accessibility (BrowserStack): https://www.browserstack.com/guide/react-accessibility  
- MDN ARIA button role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role  

---

**Conclusion:** The plan and implementation are well aligned with current best practices for React 18, TypeScript, Vite, React Router, styled-components, and SPA deployment on S3/CloudFront. The main improvements are: (1) syncing the plan with the actual stack (react-draggable, current deps, existing hooks/utils), (2) adding brief notes on performance (styled-components), deployment (API URL, CloudFront), accessibility (ARIA/semantic HTML), and Cognito (Amplify option), and (3) small implementation tweaks (types folder, optional Vite/source map and base config).
