# Deployment

Publish the Release output from `src/BloodLink.Web` to a static HTTPS host with SPA fallback routing to `index.html`. Before publishing, provide an environment-specific `wwwroot/appsettings.json` containing only:

```json
{
  "Api": {
    "BaseUrl": "https://api.example.org/"
  }
}
```

Set the backend CORS allowlist to the exact frontend origin. Configure HTTPS and response security headers at the hosting layer. A production CSP should be similarly restrictive to:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.org
```

Replace `https://api.example.org` with the exact deployed API origin. Do not add wildcard CORS, embed credentials, or log authorization headers. Session refresh material is stored in same-tab `sessionStorage`; because it is readable by scripts on the frontend origin, production deployments should assess a backend-for-frontend with HttpOnly cookies. The application does not send email and requires no frontend secrets.

Build with `dotnet publish src/BloodLink.Web --configuration Release`. Verify direct navigation and refresh fallback for every route, then smoke test login, role dashboards and representative writes against the intended backend environment.
