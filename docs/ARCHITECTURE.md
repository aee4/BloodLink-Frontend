# Architecture

BloodLink.Web is a .NET 8 Blazor WebAssembly SPA. Its only application dependency is the backend's versioned HTTP API. API request/response records in `Models/ApiModels.cs` are transport models; no EF entities, application services, database provider or server identity stores are referenced.

Typed API clients in `Services/Api` own route construction and JSON transport. `BackendApiClient` centralizes cancellation, response parsing, field-name-only validation summaries, and safe status-specific messages. The backend remains authoritative for validation, role authorization, facility boundaries, concurrency and workflow transitions.

`SessionStore` holds the short-lived access token and returned account in memory only. `BearerHandler` adds the authorization header and clears the session on 401. There is no local storage, session storage, cookie token cache or refresh-token flow. Browser reload therefore requires sign-in again.

`Workspace.razor` owns the authenticated operational routes and selects typed clients based on the current route. Role-aware links and client guards improve navigation only; every protected request is still authorized by the backend. The public configuration file contains only `Api:BaseUrl`.
