# Deployment

Publish the Release output from `src/BloodLink.Web` to a static HTTPS host with SPA fallback routing to `index.html`. Before publishing, provide an environment-specific `wwwroot/appsettings.json` containing only:

```json
{
  "Api": {
    "BaseUrl": "https://api.example.org/"
  }
}
```

Set the backend CORS allowlist to the exact frontend origin. Configure HTTPS, security headers and a restrictive Content Security Policy at the hosting layer; allow only the chosen API origin for `connect-src`, and permit the same-origin WebAssembly assets. Do not add wildcard CORS, embed credentials, or log authorization headers. The application does not send email and requires no frontend secrets.

Build with `dotnet publish src/BloodLink.Web --configuration Release`. Verify direct navigation and refresh fallback for every route, then smoke test login, role dashboards and representative writes against the intended backend environment.
