# BloodLink structural public redesign — 2026-10-04

Local design review. This second pass supersedes the first public page composition while preserving the authenticated makeover and application behavior.

## 1. What changed structurally

Replaced the public page compositions: a wide product-led Home, an editorial About, a workflow timeline, alternating feature families, a distinct login composition and registration onboarding. This builds on the existing uncommitted first makeover.

## 2. Page architecture

`PublicSite.razor` supplies the public header, skip link and footer. Each page supplies its own semantic main content. `public-experience.css` scopes the wider grid and fixed light tokens to that wrapper. The existing application router, MainLayout and session logic are unchanged.

## 3. Routes

Canonical routes are `/`, `/about`, `/how-it-works`, `/features`, `/account/login` and `/facility/register`. `/facilities/register` still renders the existing registration component directly. Header, footer and Home previews now link to the dedicated pages. Legacy `/#how-it-works`, `/#features` and `/#how` remain compatible.

## 4. Header

The shell is `min(calc(100% - 64px), 1560px)` on desktop. Its 78px header places the brand at the left and navigation/actions at the right. Each primary page has a restrained active state. The mobile menu retains its existing event handlers, Escape behavior and focus restoration.

## 5. Home

Asymmetric hero with the existing lab image; purpose strip; three separated value propositions; actual dashboard frame; three-step workflow teaser; six compact capability highlights; final registration/sign-in actions. The full process and feature descriptions live on their own pages. The headline uses a 40–68px clamp and keeps “blood supply” together.

## 6. About

Large editorial mission statement, an offset introduction, unique team image and split story, a fragmentation/problem section, asymmetric approach, four typographic principles, then a workflow CTA. It does not reuse Home's hero composition.

## 7. How it works

A native workflow diagram opens the page. Eight numbered stages cover inventory, a staff need, administrator review, administrator-initiated availability search, request, response, physical handover confirmation and updated records. Desktop stages alternate across a central line; mobile uses a vertical timeline. Three role descriptions and a Features CTA complete the page.

## 8. Features

Five grouped families: Inventory Management, Needs & Requests, Facility Operations, Visibility & Accountability, Administration & Security. Four actual interface screenshots alternate with capability descriptions. The access family uses a native role composition. No fabricated product interface or unsupported automation claims were added.

## 9. Imagery

Home retains `images/bloodlink-lab.webp`. About uses a new project-generated `images/bloodlink-team.webp` (1536×1024, 107826 bytes). Features uses actual sanitized local-fixture captures, optimized as WebP. Home's dashboard preview is also an actual capture. How it works, Login and Register use distinct native compositions. There are no external image requests or third-party stock downloads.

The imagegen skill was applied using the built-in image tool. Final About asset: `C:\Users\lenovo\Desktop\School\BloodLink-Frontend\src\BloodLink.Web\wwwroot\images\bloodlink-team.webp`. The generated original remains under `.codex/generated_images`. Prompt:

> Use case: photorealistic-natural. Asset type: BloodLink About page editorial team photograph, landscape 3:2. Primary request: a candid Ghanaian hospital team collaboration scene in a modern, bright healthcare administration room. Three Black Ghanaian healthcare professionals, two women and one man, in professional clinical attire, reviewing a tablet and paper inventory records together at a clean desk, attentive expressions and natural gestures. Contemporary hospital corridor visible softly behind glass. Natural daylight, white and warm neutral surroundings, restrained navy scrubs, realistic texture, polished editorial photography. No patients, no graphic medical imagery, no readable private information, no brand logos, no text overlays, no watermark. The scene represents collaboration, not an actual named facility or endorsement.

Meaningful alt text identifies each photo and product screen. The About caption identifies the team scene as illustrative. Product captions identify demonstration data. Product WebP sizes are approximately 25–47 KB each; all new raster assets total about 281 KB.

## 10. Login

A light desktop split uses an account → facility → connected-work composition, replacing the repeated Home photo. A 32px form title and centered panel retain the required fields, helper links and original submission code. Mobile hides the aside and keeps the panel centered at a maximum 432px.

## 11. Register

The original form is paired with an onboarding column that explains facility details, the administrator account and immediate activation. The fieldsets and password checklist remain intact. Desktop uses the wider shell; smaller screens stack the supporting information and form. The compatibility alias and success state are unchanged.

## 12. Desktop width

At 1700px the measured shell is 1560px wide with 70px margins. At 1440px it is 1376px wide with 32px margins; at 1920px the capped shell has 180px margins. Readable text widths remain inside this wider frame. Large public layouts were checked at 1024, 1280, 1440, 1700 and 1920px.

## 13. Mobile

Checked at 320, 360, 375, 390, 430 and 768px. Heroes and feature families stack, the timeline becomes vertical, footer groups remain compact, and form controls remain within the viewport. Login centering, keyboard order, menu closure, Escape focus and resizing are verified.

## 14. Public theme

The public wrapper sets `color-scheme: light` and its own white/neutral/navy/red tokens. Public pages remain light under both browser light and dark preferences. Automated checks verify white public backgrounds, light control rendering and both theme preferences at every requested width.

## 15. Authenticated application

This pass adds no changes to authenticated workflows, RBAC, session behavior, services, models or validation. The first makeover's authenticated light/dark styles are retained. Hash comparisons confirm 22 protected files are unchanged from the start of this pass. Login and registration handlers and Home lifecycle handlers match exactly. Two login inputs and 27 registration input/validation components match HEAD. Operational actions and responsive authenticated views were rechecked with intercepted fixtures; no production API requests were sent.

## 16. Files added

`Layout/PublicSite.razor`; `Pages/HowItWorks.razor`; `Pages/Features.razor`; `wwwroot/css/public-experience.css`; six WebP assets (`bloodlink-team`, `product-dashboard`, `product-inventory`, `product-requests-received`, `product-facility-staff`, `product-activity`); `scripts/verification/verify-structural-public.mjs`; this report. Local screenshots, gallery and JSON evidence are under the ignored `artifacts/ui-parity/structural-public-2026-10-04/` directory.

## 17. Files changed

PublicHeader, PublicFooter, Home, About, Login, FacilityRegister and index.html; PublicRoutingTests and PresentationParityTests; package.json's verification command; public/local/production/routing verifiers and the first-pass design verifier's route/theme expectations; ROUTES.md plus historical-status notes in PUBLIC_ROUTING.md and PUBLIC_EXPERIENCE.md. Existing first-pass changes remain uncommitted; they are not newly introduced authenticated changes in this pass.

## 18. Tests

Release build: 0 warnings/errors. Release tests: 113 passed, 0 failed, 0 skipped. `dotnet format --verify-no-changes --no-restore`: clean. NuGet including transitive dependencies: no vulnerable packages. npm audit: 0 vulnerabilities. JavaScript syntax checks and `git diff --check`: clean.

Browser evidence: 154 public layout/theme checks at all eleven requested widths; 110 keyboard navigation/history checks across those widths and both preferences; 158 separate direct/refresh/history/fragment/modified-click routing checks; 556 authenticated responsive/scenario checks; 46 login/drawer checks; 20 public asset/interaction/protected-route checks. Existing local public and public scroll/worker regression scripts also passed. Operational action checks passed in both themes. No production API requests were sent.

Direct visits and hard refreshes cover all canonical routes and the alias. Back/Forward, active routes, Home teasers, header/footer links, mobile Escape, keyboard activation and reduced motion passed. Tests validate existing forms and session boundaries as well as the new page routes. Screenshot equivalence to the old design is deliberately not a gate for this redesign.

## 19. Accessibility

162 full-document axe-core audits returned 0 WCAG 2 A/AA and WCAG 2.1 A/AA violations. These cover all seven public URLs at all eleven widths under both preferences, plus Dashboard, Inventory, Need Detail and Requests Received in both authenticated themes at 1440px. Browser page/console errors and failed assets: 0. All public image assets are bundled locally. Keyboard menu/focus and form behavior were also verified. These are automated and interaction checks, not a claim of accessibility certification.

## 20. Screenshot paths

The requested captures are linked directly below. Four additional dark workspace captures demonstrate retained authenticated theme support. Each path is an actual full-page PNG.

| Capture | Exact file path |
|---|---|
| home-light-390 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\home-light-390.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/home-light-390.png) |
| about-light-390 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\about-light-390.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/about-light-390.png) |
| how-it-works-light-390 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\how-it-works-light-390.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/how-it-works-light-390.png) |
| features-light-390 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\features-light-390.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/features-light-390.png) |
| login-light-390 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\login-light-390.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/login-light-390.png) |
| register-light-390 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\register-light-390.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/register-light-390.png) |
| home-light-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\home-light-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/home-light-1440.png) |
| home-light-1700 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\home-light-1700.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/home-light-1700.png) |
| about-light-1700 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\about-light-1700.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/about-light-1700.png) |
| how-it-works-light-1700 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\how-it-works-light-1700.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/how-it-works-light-1700.png) |
| features-light-1700 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\features-light-1700.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/features-light-1700.png) |
| login-light-1700 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\login-light-1700.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/login-light-1700.png) |
| register-light-1700 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\register-light-1700.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/register-light-1700.png) |
| dashboard-light-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\dashboard-light-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/dashboard-light-1440.png) |
| inventory-light-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\inventory-light-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/inventory-light-1440.png) |
| need-detail-light-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\need-detail-light-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/need-detail-light-1440.png) |
| requests-received-light-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\requests-received-light-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/requests-received-light-1440.png) |
| dashboard-dark-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\dashboard-dark-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/dashboard-dark-1440.png) |
| inventory-dark-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\inventory-dark-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/inventory-dark-1440.png) |
| need-detail-dark-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\need-detail-dark-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/need-detail-dark-1440.png) |
| requests-received-dark-1440 | [C:\Users\lenovo\Desktop\School\BloodLink-Frontend\artifacts\ui-parity\structural-public-2026-10-04\requests-received-dark-1440.png](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/requests-received-dark-1440.png) |

Optional [review gallery](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/gallery.html). Machine-readable evidence: [verification-summary.json](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/verification-summary.json), [browser-verification.json](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/browser-verification.json), [functional-integrity.json](C:/Users/lenovo/Desktop/School/BloodLink-Frontend/artifacts/ui-parity/structural-public-2026-10-04/functional-integrity.json).

## 21. Git status

HEAD remains `0a83b1f44e9bd82e538e664ddac0cc7fbe184e0f`. No files are staged. All first- and second-pass work remains local and uncommitted. No commit, push, deployment, AWS change or backend modification was performed. The final status inventory is recorded in `verification-summary.json`; it includes the existing first-pass modifications and the new second-pass files. Screenshot/evidence artifacts are ignored by Git.

BLOODLINK STRUCTURAL PUBLIC REDESIGN READY FOR VISUAL REVIEW
