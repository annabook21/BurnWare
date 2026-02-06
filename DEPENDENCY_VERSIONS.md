# Dependency versions (latest as of research)

Researched via `npm view <pkg> version`. Use for upgrades; test after major bumps.

---

## Root (CDK)

| Package | Latest | Notes |
|---------|--------|-------|
| aws-cdk | 2.237.1 | CLI |
| aws-cdk-lib | 2.237.1 | |
| constructs | 10.4.5 | |
| typescript | 5.9.3 | |
| @types/node | 25.2.1 | |
| eslint | 9.39.2 | |
| prettier | 3.8.1 | |
| source-map-support | 0.5.21 | |
| ts-node | 10.9.2 | |
| @typescript-eslint/eslint-plugin | 8.x | |
| @typescript-eslint/parser | 8.x | |

---

## App (API)

| Package | Latest | Notes |
|---------|--------|-------|
| express | 5.2.1 | |
| pg | 8.18.0 | |
| helmet | 8.1.0 | |
| winston | 3.19.0 | |
| joi | 18.0.2 | Major: 17 → 18 |
| aws-jwt-verify | 5.1.1 | |
| aws-xray-sdk-core | 3.12.0 | |
| @aws-sdk/client-s3 | 3.984.0 | |
| @aws-sdk/client-secrets-manager | 3.984.0 | |
| @aws-sdk/client-ssm | 3.984.0 | |
| cors | 2.8.6 | |
| express-rate-limit | 8.2.1 | Major: 7 → 8 |
| qrcode | 1.5.4 | |
| dotenv | 17.2.4 | Major: 16 → 17 |
| uuid | 13.0.0 | Major: 11 → 13 |
| @types/express | 5.0.6 | |
| @types/node | 25.2.1 | |
| @types/cors | 2.8.19 | |
| @types/qrcode | 1.5.6 | |
| @types/uuid | 11.0.0 | |
| ts-node | 10.9.2 | |
| jest | 30.2.0 | Major: 29 → 30 |
| @types/jest | 30.0.0 | |
| ts-jest | 29.4.6 | |
| supertest | 7.2.2 | |
| @types/supertest | 6.0.3 | |

---

## Frontend

| Package | Latest | Notes |
|---------|--------|-------|
| react | 19.2.4 | Major: 18 → 19 |
| react-dom | 19.2.4 | |
| react-router-dom | 7.13.0 | Major: 6 → 7 |
| vite | 7.3.1 | Major: 6 → 7 |
| styled-components | 6.3.8 | |
| axios | 1.13.4 | |
| howler | 2.2.4 | |
| react-draggable | 4.5.0 | |
| 98.css | 0.1.21 | |
| qrcode.react | 4.2.0 | |
| amazon-cognito-identity-js | 6.3.16 | |
| @vitejs/plugin-react | 5.1.3 | Major: 4 → 5 (Vite 7) |
| @types/react | 19.2.13 | Match React 19 |
| @types/react-dom | 19.2.3 | |
| **@types/howler** | **2.2.12** | **No 2.2.13 on npm** — use ^2.2.12 |
| @types/styled-components | 5.1.36 | |
| typescript | 5.9.3 | |
| eslint | 9.39.2 | |
| @typescript-eslint/* | 8.x | |

---

## Upgrade notes

- **Frontend:** `@types/howler@^2.2.13` does not exist; use `^2.2.12` (fixed in package.json).
- **React 19 / Vite 7 / React Router 7:** Optional major upgrades; validate compatibility (e.g. Vite 7 + @vitejs/plugin-react 5) before moving.
- **App:** joi 18, express-rate-limit 8, dotenv 17, uuid 13, jest 30 are major bumps; test after upgrading.
