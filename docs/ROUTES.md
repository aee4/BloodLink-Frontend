# Routes

| Route | Access / purpose |
|---|---|
| `/` | Public home |
| `/account/login` | Public sign-in |
| `/facilities/register` | Public registration; `/facility/register` is retained as an alias |
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
