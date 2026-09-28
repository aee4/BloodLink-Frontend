# API Integration Checklist

Contract source: BloodLink Backend session-refresh release, especially `docs/API_CONTRACTS.md`, `docs/AUTHENTICATION.md`, controller routes and API contract records. Base URL is configured by public `Api:BaseUrl`; local development uses `http://localhost:5249/`. The backend must allow the exact frontend origin.

| Backend endpoint | Frontend client / screen | Status |
|---|---|---|
| `POST /api/v1/auth/login` | AuthApiClient / account login | Integrated |
| `POST /api/v1/auth/refresh` | SessionRefreshService / startup and 401 recovery | Integrated; rotates refresh credentials |
| `GET /api/v1/auth/me` | AuthApiClient.Current | Client available |
| `POST /api/v1/auth/logout` | AuthApiClient / sidebar | Integrated |
| `POST /api/v1/auth/change-password` | AuthApiClient / account | Integrated |
| `POST /api/v1/facilities/register` | FacilityApiClient / registration | Integrated |
| `GET /api/v1/facilities/me` | FacilityApiClient / profile | Integrated |
| `PUT /api/v1/facilities/me` | FacilityApiClient / profile | Integrated |
| `GET /api/v1/system/facilities` | FacilityApiClient / governance list | Integrated |
| `GET /api/v1/system/facilities/{id}` | FacilityApiClient / governance detail | Integrated |
| `POST /api/v1/system/facilities/{id}/approve` | FacilityApiClient | Integrated |
| `POST /api/v1/system/facilities/{id}/reject` | FacilityApiClient | Integrated |
| `POST /api/v1/system/facilities/{id}/suspend` | FacilityApiClient | Integrated |
| `POST /api/v1/system/facilities/{id}/restore` | FacilityApiClient | Integrated |
| `GET /api/v1/staff` | StaffApiClient / staff list | Integrated |
| `POST /api/v1/staff` | StaffApiClient / create | Integrated |
| `POST /api/v1/staff/{id}/activate` | StaffApiClient / staff list | Integrated |
| `POST /api/v1/staff/{id}/deactivate` | StaffApiClient / staff list | Integrated |
| `GET /api/v1/inventory` | InventoryApiClient / inventory | Integrated |
| `POST /api/v1/inventory/adjustments` | InventoryApiClient / adjust | Integrated |
| `GET /api/v1/inventory/history` | InventoryApiClient / history | Integrated |
| `GET /api/v1/inventory/search` | InventoryApiClient / search | Integrated |
| `GET /api/v1/inventory/low-stock` | InventoryApiClient | Client available |
| `POST /api/v1/needs` | NeedApiClient / submit | Integrated; browser-local deadline converted to UTC |
| `GET /api/v1/needs/mine` | NeedApiClient / mine | Integrated |
| `GET /api/v1/needs` | NeedApiClient / facility needs | Integrated |
| `GET /api/v1/needs/{id}` | NeedApiClient / detail | Integrated |
| `GET /api/v1/needs/{id}/timeline` | NeedApiClient | Client available |
| `POST /api/v1/needs/{id}/start-search` | NeedApiClient | Integrated |
| `POST /api/v1/needs/{id}/fulfil-internally` | NeedApiClient | Integrated |
| `POST /api/v1/needs/{id}/reject` | NeedApiClient | Integrated |
| `POST /api/v1/needs/{id}/cancel` | NeedApiClient | Integrated |
| `POST /api/v1/requests` | RequestApiClient / sent requests | Integrated |
| `GET /api/v1/requests/sent` | RequestApiClient | Integrated |
| `GET /api/v1/requests/received` | RequestApiClient | Integrated |
| `GET /api/v1/requests/{id}` | RequestApiClient / detail | Integrated |
| `GET /api/v1/requests/{id}/timeline` | RequestApiClient | Client available |
| `POST /api/v1/requests/{id}/accept` | RequestApiClient | Integrated |
| `POST /api/v1/requests/{id}/reject` | RequestApiClient | Integrated |
| `POST /api/v1/requests/{id}/cancel` | RequestApiClient | Integrated |
| `POST /api/v1/requests/{id}/fulfil` | RequestApiClient | Integrated |
| `GET /api/v1/notifications` | NotificationApiClient / notifications | Integrated |
| `GET /api/v1/notifications/unread-count` | NotificationApiClient | Client available |
| `POST /api/v1/notifications/{id}/read` | NotificationApiClient / notifications | Integrated |
| `POST /api/v1/notifications/read-all` | NotificationApiClient | Client available |
| `GET /api/v1/dashboard` | DashboardApiClient / dashboard | Integrated |

The API uses the backend's real status codes and DTO property names. Enum values are transported numerically. Need deadlines are ISO-8601 UTC, and the server independently rejects non-future timestamps.
