# Public routing consistency — 2026-10-04

The deployment audit below is historical. The current uncommitted makeover uses dedicated `/how-it-works` and `/features` pages in the header, footer and Home previews. Legacy Home fragments remain compatible. The complete makeover, including the restored Login/Register designs, is deployed; see [the deployment verification](COMPLETE-VISUAL-MAKEOVER-DEPLOYMENT-2026-10-04.md) for current production results and the authenticated verification limitation.

Base commit: `6b51e87ef0014fd09aee0725d07e0f7f09aca0eb`. The fix was deployed to the existing frontend stack on 2026-10-04. This report records verification at the deployment handoff, before Git publication.

## Audit and final destinations

| Public navigation or action | Destination | Locations |
|---|---|---|
| Home / BloodLink brand | `/` | Desktop and mobile header, header/footer brand, login Return to home, registration Back to BloodLink |
| About | `/about` | Desktop and mobile header, footer |
| Sign in / Log in / Facility login | `/account/login` | Desktop header action, mobile menu, footer, Home hero/final CTA, About final CTA, registration success |
| Register / Register your facility | `/facility/register` | Desktop header action, mobile menu, footer, Home hero/final CTA, About hero/final CTA, login helper |
| How it works | `/#how-it-works` | Desktop and mobile header, footer; targets the Home workflow section |
| Features | `/#features` | Desktop and mobile header, footer; targets the Home feature section |
| Skip to main content | `#main-content` | Home, About, login, registration; intentionally local to the current page |

There are no separate public Learn more / Join BloodLink CTA components, public NavLinks, or placeholder About fragments. The footer's Get started heading groups registration and sign-in links; it is not itself a link. The generic unused starter NavMenu and protected workspace navigation are outside public navigation.

## Root cause and behavior

The existing primary links already used the canonical routes. The workflow section and links used `how`, leaving the requested direct `/#how-it-works` URL without a target. Initial browser fragment resolution could run before asynchronous Blazor rendering. Selecting an already-current fragment also produced another Blazor history entry. Route documentation incorrectly described the plural registration path as canonical.

Home now renders the canonical workflow target and retains `how` for compatibility. A small script loaded before Blazor resolves known Home fragments after Home's first render, using the existing sticky-header scroll margin. It creates no history entries and scrolls instantly during restoration. Ordinary anchor scrolling retains existing CSS smooth scrolling and reduced-motion behavior. Re-selecting the current Home section scrolls without another history entry. Ctrl/Cmd, Shift, Alt, non-primary clicks, explicit targets, and downloads retain native browser handling.

Both registration URLs render the same existing component directly, without a redirect or loop. Every public registration link uses the singular route. Authentication submission, return-URL handling, session restoration, and the existing authenticated Home redirect remain unchanged.

Header active state uses the URL path: Home for `/` and its fragments, About for `/about`, sign-in for `/account/login`, registration for either registration path. Each desktop/mobile primary navigation set has exactly one current page. Section links do not compete with Home for `aria-current="page"`. Mobile navigation closes on link activation or a location change; Escape closes it and restores focus to the toggle. Route changes retain the app's existing heading focus behavior.

## Reproduce verification

Run the local Release app at `http://127.0.0.1:5081`, then from `scripts/verification` run `npm run verify:public:routing`. Optionally set `PUBLIC_BASELINE_URL` to an unchanged local checkout served on another port to compare screenshots byte for byte. Only localhost URLs are accepted.

The browser verifier records URL, active destination, scroll offset/target, menu state, focus, overflow, and browser errors at 375, 768, 1440, and 1920px. It covers direct visits and refreshes, Home → About → Login → Back → Back, forward navigation, cross-route and same-page fragments, repeated section links, Login → Register → About, footer links, mobile Escape, keyboard activation, Ctrl-click, reduced motion, and mobile login centering.

Evidence and screenshots are written to `artifacts/ui-parity/public-routing-2026-10-04/` (ignored by Git). Quality gates: restore, Release build, Release tests with no build, format verification, transitive vulnerability audit, JavaScript syntax checks, and `git diff --check`.

## Verified results

- All quality gates passed; Release build: 0 warnings, 0 errors; tests: 108 passed, 0 failed, 0 skipped (13 new routing cases); no vulnerable direct or transitive packages reported.
- Chromium: 142 recorded route/state checks across all four widths; no console/page errors or failed HTTP requests. Direct visits and hard refreshes passed for all primary routes, the registration alias, both Home section links, and the legacy workflow fragment.
- Back/Forward sequences, fragment return to About, menu closure, Escape focus restoration, keyboard links, Ctrl-click, repeated-fragment history, reduced motion, and mobile login centering passed.
- All 16 full-page screenshot comparisons (four pages at four widths) were byte-for-byte identical to the base commit. Stylesheets, favicon, imagery, authentication logic, backend, and deployment scripts were unchanged.
- At the initial local handoff: six modified tracked files and four new files; no commit, push, or deployment. The temporary baseline checkout was used only for comparison and removed afterward.

## Production deployment and verification

The existing deployment script published the Release frontend to the dedicated S3 bucket in `bloodlink-frontend-prod`. CloudFormation reported no infrastructure changes. CloudFront distribution `E2CFHIKLVUFJJ9` reached `Deployed`; invalidation `I14H36Q9ZT97AI34ARHW02S2KX` for `/*` reached `Completed`.

Production URL: `https://d2z1pcfp95dfwd.cloudfront.net`.

- Final predeployment gates: 108 tests passed, 0 failed/skipped, 0 build warnings/errors, no vulnerable packages; 142 local routing checks; existing public regression passed; all 16 screenshots still matched the original commit.
- Production routing: 178 recorded checks at 375, 430, 768, 1440, and 1920px. All canonical routes, registration alias, direct visits, hard refreshes, workflow/features fragments, navigation sequences A/B/C, Back/Forward, repeated-section history, active states, keyboard/modified clicks, and menu closure passed. Document markers confirmed primary navigation and sequence A stayed within the same document.
- Mobile menu and Escape focus restoration passed at 375px and 430px (also 768px). No duplicate fragment entries or unexpected section scroll on primary routes.
- All 20 production full-page screenshots matched the locally verified appearance byte for byte; the four requested widths also retain the 16 original-commit comparisons. Mobile login centering remained correct. Nine production stylesheet/script/icon/manifest/image assets returned 200 and matched local SHA-256 hashes. The existing production regression verifier passed its 20 checks, including micro-interactions, validation, icons, reduced motion, and the protected-route access boundary.
- Final production run: 0 browser errors, 0 failed requests, no horizontal overflow, no broken fragments, no service worker registrations/controller, and no CSP or mixed-content errors. Production CSP and index revalidation headers were present.
- An initial verification attempt emitted errors from its own secure-context-only document-marker instrumentation on blank setup pages. The instrumentation was corrected without changing application code; the complete final run passed with no errors.
- Backend code, Lambda, API Gateway, RDS, IAM, VPC/security groups, and production data were untouched. At the deployment handoff there was no commit or push; Git status showed six modified tracked files and four new files.

Deployment logs, AWS statuses, quality gates, production routing states, asset hashes, regression results, and screenshots are under `artifacts/ui-parity/public-routing-deployment-2026-10-04/` (ignored by Git). The production-only harness is generated there from the reviewed local routing verifier with an exact production-origin allowlist; it adds 430px, document markers, service-worker and asset checks. The successful final report is `verification-summary.json`; the first harness attempt is preserved separately.
