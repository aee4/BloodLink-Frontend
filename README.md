# BloodLink Frontend

Independent .NET 8 Blazor WebAssembly client for BloodLink facility registration, blood inventory, needs, requests and notifications. The application depends on the separately hosted [BloodLink Backend](https://github.com/aee4/BloodLink-Backend) HTTP API; this repository contains no server, database or domain-project references.

## Production

- Live frontend: https://d2z1pcfp95dfwd.cloudfront.net
- Frontend repository: https://github.com/aee4/BloodLink-Frontend
- Backend repository: https://github.com/aee4/BloodLink-Backend
- Production API: https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com

For local setup, install the .NET 8 SDK, then run the restore, Release build, and app commands below. Password-reset delivery is currently disabled.

## Requirements

- .NET 8 SDK
- A running BloodLink API for authenticated workflows
- Chromium or another modern browser

The checked-in Development configuration points to `http://localhost:5249/`. Change `Api:BaseUrl` in `src/BloodLink.Web/wwwroot/appsettings.json` for another environment. Static hosts can replace that public JSON file at deploy time without recompiling the application. It must contain only the API base URL, never credentials.

```powershell
dotnet restore BloodLink.Frontend.sln
dotnet build BloodLink.Frontend.sln --configuration Release
dotnet test BloodLink.Frontend.sln --configuration Release --no-build
dotnet run --project src/BloodLink.Web --launch-profile http
```

The local frontend is served at `http://localhost:5081`. The backend must allow that origin through its CORS configuration. See [API integration](docs/API_INTEGRATION.md), [authentication](docs/AUTHENTICATION.md), and [deployment](docs/DEPLOYMENT.md).

Bearer tokens stay in application memory and are cleared on logout, password change, unauthorized response, or full page restart. Password recovery is unavailable; contact a facility administrator. Facility staff passwords are set during account creation and are never displayed after submission.

## Structure

- `src/BloodLink.Web`: standalone browser application, typed HTTP clients, API models and UI.
- `tests/BloodLink.Web.Tests`: route and security-focused unit tests.
- `docs`: architecture, endpoint checklist, route map, test and deployment guidance.

This is a frontend client, not a security boundary. Authorization and all business rules remain enforced by the backend.
