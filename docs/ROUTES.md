# Routes

| Route | Access / purpose |
|---|---|
| `/` | Public home |
| `/about` | Public product and mission information |
| `/account/login` | Public sign-in |
| `/facility/register` | Canonical public registration; `/facilities/register` remains a compatibility alias |
| `/account/manage` | Signed-in account information |
| `/account/change-password` | Signed-in password update |
| `/dashboard` | Role-specific dashboard |
| `/facility/profile` | Facility administrator profile |
| `/facility/staff`, `/facility/staff/create` | Facility administrator staff management |
| `/system/facilities`, `/system/facilities/{id}` | System administrator governance |
| `/inventory`, `/inventory/adjust`, `/inventory/history`, `/inventory/search` | Inventory views and adjustment |
| `/needs/new`, `/needs/mine`, `/needs`, `/needs/{id}` | Staff need entry and facility need management |
| `/requests/sent`, `/requests/received`, `/requests/{id}` | Facility administrator request workflow |
| `/notifications` | Signed-in notification list |
| `/access-denied` | Access-denied state |

Unmatched paths display the not-found state. Backend authorization remains decisive for every protected operation.
