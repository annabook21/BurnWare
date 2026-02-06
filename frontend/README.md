# BurnWare Frontend (React SPA)

React-based single-page application for BurnWare.

## Features

- Cognito authentication
- Link management dashboard
- Thread viewing and burning
- QR code display
- Anonymous message sending interface

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output in `dist/` directory, ready for S3 upload.

## Environment Variables

Create `.env.local`:

```
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_BASE_URL=https://api.burnware.example.com
```

## Deployment

Deployed to S3 and served via CloudFront:

```bash
npm run build
aws s3 sync dist/ s3://BUCKET_NAME/
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

## Caching Strategy

- `index.html`: 5-minute TTL (fast updates)
- Static assets: 1-year TTL (versioned filenames)

Reference: https://aws.amazon.com/blogs/networking-and-content-delivery/host-single-page-applications-spa-with-tiered-ttls-on-cloudfront-and-s3/
