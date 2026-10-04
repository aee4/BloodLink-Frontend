# Public experience audit and redesign

This is the historical initial public redesign audit. The current local second pass replaces the compositions and shared-photo strategy described below. See [the structural public review](STRUCTURAL-PUBLIC-REDESIGN-2026-10-04.md) for the dedicated routes, unique visuals, wide shell and fixed light public theme.

This note covers the routes reachable without signing in. Protected workspace pages and the authenticated sidebar are outside the redesign scope.

## Route audit

| Route | Before | Current layout and components | Image, type, and calls to action | Responsive and accessibility notes |
|---|---|---|---|---|
| `/` | Standalone landing page with public header/footer, a vector network illustration, and unsupported facility/network counts. | Public header, semantic hero, value cards, ordered workflow, final call to action, and shared footer. | Locally stored BloodLink lab photograph; system sans-serif; facility registration and sign-in actions. | Single column at tablet/mobile, descriptive image alt, skip link, heading hierarchy, visible keyboard focus, reduced-motion rules. |
| `/about` | No About route; header/footer pointed to an in-page placeholder instead. | Public header, product description, four mission/workflow sections, final actions, shared footer. | Same locally stored photograph, lazy loaded; system sans-serif; register and sign-in actions. | Responsive image and card layout; semantic headings, alt text, skip link and focus states. |
| `/account/login` | Split sign-in page with fabricated network statistics and no shared public navigation/footer. | Shared public header/footer and sign-in form with concise product context. | Shared local photo used as a cropped CSS background at desktop; system sans-serif; sign in and register actions. | Form remains narrow and single column on small screens; labelled required inputs, keyboard focus, skip link and reduced motion. |
| `/facility/register` and `/facilities/register` | Standalone form without shared public navigation/footer. | Shared public header/footer around the existing grouped facility and administrator form. | No additional image; system sans-serif; submit registration and sign-in after success. | Existing field validation, password checklist, backend model, and submission code remain unchanged; form collapses to one column on small screens. |

## Visual and asset decisions

- The public palette keeps BloodLink burgundy/red with navy and neutral backgrounds. Typography uses system fonts already available on each device.
- `wwwroot/images/bloodlink-lab.webp` is an original AI-generated illustration rendered as realistic healthcare photography. It depicts a Ghanaian laboratory professional checking a sealed blood unit and records. It was generated for this project, has no external source URL, logo, text, or implied partner facility, and is stored locally.
- The image is 1200 by 800 pixels and about 69 KB in WebP format. The landing hero loads eagerly with intrinsic dimensions; the About image is lazy loaded. The login background reuses the same local asset.
- The BloodLink drop and cross appears as SVG and 16, 32, and 192 pixel PNGs, plus a two-size ICO. The web manifest points to the branded 192 pixel icon. No Blazor starter icon remains in the public icon set.
- Public navigation no longer includes invented contact details or placeholder privacy/terms links. Public copy contains no fabricated facility counts, endorsements, partners, or testimonials.

## Motion and interaction

Public buttons, cards, fields, and navigation use short transitions around 150–250 ms. The mobile menu exposes expanded state, becomes inert while closed, closes on Escape, and remains keyboard operable. Reduced-motion preferences remove public transitions and smooth scrolling.
