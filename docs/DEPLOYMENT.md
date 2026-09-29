# Deployment

## AWS production hosting

The frontend is hosted by the `bloodlink-frontend-prod` CloudFormation stack in `eu-north-1`. It provisions an encrypted, private S3 bucket and a CloudFront distribution using Origin Access Control (OAC). S3 public access is blocked, and the bucket policy permits reads only from that distribution. The default CloudFront certificate provides the HTTPS `cloudfront.net` origin. No backend resource is managed by this stack.

The production API base URL in `src/BloodLink.Web/wwwroot/appsettings.json` is `https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com`. This value is public configuration. Do not put access tokens, refresh tokens, credentials or keys in appsettings or published files. Access tokens exist in memory; refresh-session material is read from and written to same-tab `sessionStorage` through the browser storage module.

Deploy from the repository root with:

```powershell
./scripts/deploy-aws-cloudfront.ps1
```

The script requires the `bloodlink-deployer` IAM identity and configured region `eu-north-1`. It publishes Release `wwwroot`, deploys only the named frontend stack, syncs only its generated dedicated bucket, removes stale files from that bucket, invalidates CloudFront, and waits for the distribution and invalidation to complete. Files are uploaded with revalidation required by default; files whose names contain a fingerprint receive a one-year immutable cache policy. CloudFront's cache policy honors those origin metadata values. The deploy output includes the bucket, distribution ID, CloudFront domain and complete HTTPS URL.

CloudFront maps S3 `403` and `404` responses to `/index.html` with status `200` and error caching TTL `0`, allowing direct navigation to Blazor routes. The distribution redirects HTTP viewers to HTTPS and compresses responses. Its response headers include a restrictive CSP (`connect-src 'self' https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com`), frame/content-type protections, HSTS, referrer and permissions policies. Blazor WebAssembly's `wasm-unsafe-eval` is allowed for runtime compilation; other script sources are same-origin.

CloudFront URL: `https://d2z1pcfp95dfwd.cloudfront.net` (distribution `E2CFHIKLVUFJJ9`).

## Teardown

After confirming the bucket name from the stack outputs, remove only that dedicated bucket's objects and then delete the frontend stack:

```powershell
aws s3 rm s3://<BucketName> --recursive --region eu-north-1
aws cloudformation delete-stack --stack-name bloodlink-frontend-prod --region eu-north-1
aws cloudformation wait stack-delete-complete --stack-name bloodlink-frontend-prod --region eu-north-1
```

This teardown removes the frontend distribution, OAC, policies and bucket. It does not touch backend resources.

## Backend CORS and workflow testing

After deployment, configure backend CORS to allow the exact CloudFront HTTPS origin printed by the deployment script. Do not use wildcard origins. Until that exact origin is added to backend CORS, cross-origin API calls can fail by design. Do not claim authenticated end-to-end success before CORS is updated. No backend CORS change is part of this frontend deployment.

Once CORS is configured, verify direct navigation and refresh fallback for the routes in `docs/ROUTES.md`, then exercise login, role dashboards and representative workflows against the intended backend environment.
