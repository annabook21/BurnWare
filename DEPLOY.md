# BurnWare Deployment

## CDK Deployment (Frontend + Backend)

Both frontend and backend are deployable via AWS CDK.

### Frontend (built-in)

The **Frontend** stack builds and deploys the React SPA to S3 + CloudFront:

```bash
# Deploy frontend only
npx cdk deploy BurnWare-Frontend-dev

# Or deploy all stacks (frontend deploys automatically)
npx cdk deploy --all
```

The frontend is built during `cdk deploy` (via local `npm run build` or Docker).

### Backend (optional)

The **Backend** API is deployed to S3 when:

1. The App stack has a deployment bucket (from Data stack)
2. `deployBackend` context is enabled

To deploy the backend artifact via CDK:

```bash
# Fix any app TypeScript/build issues first, then:
npx cdk deploy BurnWare-App-dev -c deployBackend=true
```

**Note:** The app must build successfully (`cd app && npm run build`). If the app has TypeScript errors, deploy with `deployBackend` unset or false; EC2 will run a minimal health server until you manually upload the API artifact.

### Manual deployment (alternative)

- **Frontend:** `cd frontend && npm run build && aws s3 sync dist/ s3://burnware-dev-frontend/`
- **Backend:** Build app, create tarball, upload to `s3://burnware-dev-deployments/releases/app-1.0.0.tar.gz`
