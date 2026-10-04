# BloodLink Login/Register restoration - 2026-10-04

Local review only. No commit, push, deployment, AWS change or production API access.

1. **Login restoration:** Restored the first-pass photo-backed desktop aside, brand, quotation and sign-in card. Restored the previously approved centered mobile card and balanced spacing. Kept the current public header/footer, helper links, native validation and Login route.

2. **Register restoration:** Removed the second-pass onboarding sidebar and wide registration grid. Restored the centered 50rem form container and previous card styling, responsive fieldsets and spacing. Both registration routes remain available. The entire EditForm and registration handler are unchanged. Retained the truthful immediate-activation/access-controls disclosure as a compact heading note.

3. **Password toggle:** Local Blazor visibility state defaults to false. The existing password input switches between password/text and keeps its binding, value and current-password autocomplete. The native type=button control uses Lucide eye/eye-off icons, Show password/Hide password labels, aria-controls and aria-pressed. Its 44x44 target has visible keyboard focus. The input geometry remains identical through both toggles. Authentication and session handlers are unchanged.

4. **Files changed in this targeted revision:**

   - src/BloodLink.Web/Pages/Login.razor
   - src/BloodLink.Web/Pages/FacilityRegister.razor
   - src/BloodLink.Web/wwwroot/css/public-experience.css
   - src/BloodLink.Web/Components/Shared/AppIcon.razor
   - src/BloodLink.Web/Components/InlineValidationMessage.razor
   - tests/BloodLink.Web.Tests/LoginPasswordToggleTests.cs
   - scripts/verification/verify-login-drawer.mjs
   - scripts/verification/verify-access-restoration.mjs
   - scripts/verification/verify-access-registration-flow.mjs
   - docs/ACCESS-RESTORATION-2026-10-04.md

   Evidence is saved under artifacts/ui-parity/access-restoration-2026-10-04/ (ignored by Git). Home, About, How it works, Features, PublicHeader and PublicFooter are unchanged from the approved local structural redesign. The marketing CSS rules are also unchanged. SHA-256 checks confirm 28 protected application files are unchanged.

5. **Tests added/updated:** Six xUnit cases cover the default visibility state, independent password/visibility state, native input/autofill/accessibility contracts and the three access routes. Updated the existing Login/drawer verifier to include the new toggle in the Tab order. Added browser checks for hidden/visible/hidden transitions, unchanged password values, non-submit button behavior, changing labels, input geometry, keyboard Space/Tab, focus visibility, empty-form validation, normal Enter submission and exact password preservation in the intercepted login payload. Registration browser checks cover invalid form errors/focus and successful submission through both routes.

6. **Final test count:** dotnet test BloodLink.Frontend.sln --configuration Release --nologo passed: **119 passed, 0 failed, 0 skipped**. Release compilation completed without warnings or errors. Verification scripts pass Node syntax checks.

7. **Browser verification:** **32 passed cases**, in Chromium, with both light and dark system preferences; the public pages remain light in both.

   - Login: 320, 360, 375, 390, 430, 768, 1440, 1700 pixels.
   - Register canonical and compatibility alias: 390, 768, 1440, 1700 pixels each.
   - No horizontal overflow. Mobile Login is centered; desktop uses the restored photo aside. Register has its centered constrained container. Toggle alignment and touch size pass. No toggle-induced input layout shift. Keyboard and Enter submission pass at every Login width.
   - Two additional successful registration flows pass with fully intercepted local API fixtures. No production data is read or written.
   - [Screenshot gallery](../artifacts/ui-parity/access-restoration-2026-10-04/gallery.html), [verification summary](../artifacts/ui-parity/access-restoration-2026-10-04/verification-summary.json), [browser evidence](../artifacts/ui-parity/access-restoration-2026-10-04/browser-verification.json), [integrity evidence](../artifacts/ui-parity/access-restoration-2026-10-04/integrity-verification.json).

8. **Accessibility:** **32 axe audits; zero WCAG 2 A/AA and WCAG 2.1 AA violations**, including registration validation-error states. Browser checks confirm keyboard focus and changing toggle labels. Fixed an existing error-list semantics issue by replacing role=alert on its ul with aria-live=assertive and aria-atomic=true; the list semantics and live error announcements are preserved. This changes presentation semantics only.

9. **Git status:** HEAD remains 0a83b1f44e9bd82e538e664ddac0cc7fbe184e0f. The combined local redesign worktree has 35 modified files, 1 deletion and 23 untracked files; nothing is staged. These totals include earlier first- and second-pass work. No commit, push or deployment was performed.

LOGIN/REGISTER RESTORATION AND PASSWORD TOGGLE READY FOR VISUAL REVIEW
