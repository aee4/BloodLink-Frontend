# BloodLink UI Visual Parity

## Reference

The read-only source of truth is `BloodBankSys` commit `24bc919646cc77c12df47ccb25df0aeb2a7681c7`. The standalone remains a Blazor WebAssembly application using its existing typed API clients and session services.

## Parity Matrix

| Area | Standalone implementation | Local evidence | Remaining verification |
|---|---|---|---|
| Public pages and registration | Restored branded header, home, hero, responsive menu, registration and login. | Existing local visual review and test coverage. | Production delivery and direct-route checks. |
| Authenticated navigation | Role-specific navigation, facility identity, active route, logout, responsive toggle, Escape handling and focus return. | Chromium fixtures exercise all three roles at four viewport sizes. | Check real role sessions in production. |
| Dashboards | Role-specific summary cards, review/need lists and activity panels. | All three role dashboards exercised against intercepted fixture API responses. | Confirm live API data shape and values. |
| Facility and staff | Structured facility list/detail/profile, status and decision views; staff records, status actions and creation form. | SystemAdmin and FacilityAdmin route, layout, interaction and responsive checks. | Verify permitted decisions and staff lifecycle with authorized accounts. |
| Inventory | Stock summaries, adjustment, history, network availability and paged tables with blood-type labels. | FacilityAdmin routes exercised with fixture inventory/history/search responses. | Confirm live data and paging behavior. |
| Needs and requests | Typed lists/details, facts, status/urgency labels, timeline, submission and workflow actions. Request acceptance is constrained by requested units and available source stock. | FacilityAdmin and FacilityStaff routes exercised with intercepted fixture responses; interaction and responsive assertions included. | Verify reservation, authorization and workflow transitions against production. |
| Notifications and account | Read/unread notification presentation/actions, account facts/access states, password form and contextual facility state. | Role route checks and fabricated notification/account data. | Verify live notification state and account workflows. |
| Shared states and responsive behavior | Dedicated loading, error and empty states; structured forms, tables, details and pagination. | Local Chromium checks at 375×667, 768×1024, 1440×900 and 1920×1080 include scroll, overflow, navigation, dialog and selected error/empty states. | Complete production browser review after an approved deployment. |

## Local Evidence

`scripts/ui-parity.mjs` launches local Chromium and intercepts API traffic with fabricated fixture identities and records. It does not contact production and does not need credentials. Screenshots and browser output are written under ignored `artifacts/ui-parity/`; they are local-only evidence, not proof of authenticated production behavior.

## Production Verification Record

The restored UI is deployed at the production CloudFront URL. Public production verification passed. SystemAdmin login passed, the dashboard passed, the zero-service-worker state passed, and the facility governance page returned a valid empty facility state. Account navigation and rendering passed. The Account assertion initially failed because the verifier used a broad heading regex that matched both the `Account` h1 and `Account details` h2; the production page rendered correctly. The selector was corrected to the exact accessible name. The final automated logout tail was not rerun after that selector correction. Logout and session behavior remain covered by existing automated tests, including logout clearing browser session material and protected-route/session restoration behavior. No production application defect was found, and no redeployment was needed for this verifier-only correction.

Never store credentials, tokens, or authenticated personal data in screenshots or artifacts. For future application changes, review the source parity matrix and use the local fixture harness as local evidence only; it cannot substitute for live checks.
