using System.Text.RegularExpressions;

namespace BloodLink.Web.Tests;

public sealed class PresentationParityTests
{
    private static readonly string Root = FindRoot();

    [Fact]
    public void Public_home_restores_original_sections_and_exact_actions()
    {
        var home = Read("src/BloodLink.Web/Pages/Home.razor");

        Assert.Contains("Coordinate blood stock.", home, StringComparison.Ordinal);
        Assert.Contains("Save lives faster.", home, StringComparison.Ordinal);
        Assert.Contains("bl-network-canvas", home, StringComparison.Ordinal);
        Assert.Contains("id=\"how\"", home, StringComparison.Ordinal);
        Assert.Contains("id=\"features\"", home, StringComparison.Ordinal);
        Assert.Contains("href=\"/facility/register\"", home, StringComparison.Ordinal);
        Assert.Contains("href=\"/account/login\"", home, StringComparison.Ordinal);
    }

    [Fact]
    public void Public_and_authenticated_navigation_have_working_mobile_controls()
    {
        var publicHeader = Read("src/BloodLink.Web/Layout/PublicHeader.razor");
        var sidebar = Read("src/BloodLink.Web/Layout/DashboardSidebar.razor");

        Assert.Contains("aria-expanded=\"@(_menuOpen ? \"true\" : \"false\")\"", publicHeader, StringComparison.Ordinal);
        Assert.Contains("HandleKeyDown", publicHeader, StringComparison.Ordinal);
        Assert.Contains("href=\"/facility/register\"", publicHeader, StringComparison.Ordinal);
        Assert.Contains("href=\"/account/login\"", publicHeader, StringComparison.Ordinal);
        Assert.Contains("aria-expanded=\"@(_menuOpen ? \"true\" : \"false\")\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("href=\"/inventory\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("href=\"/needs/new\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("href=\"/needs/mine\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("SignOut", sidebar, StringComparison.Ordinal);
        Assert.Contains("@onclick=\"CloseMenu\"", sidebar, StringComparison.Ordinal);
    }

    [Fact]
    public void Document_and_application_shell_allow_page_scrolling()
    {
        var css = Read("src/BloodLink.Web/wwwroot/app.css");

        Assert.Contains("html { min-width: 320px; min-height: 100%;", css, StringComparison.Ordinal);
        Assert.Contains("body { min-height: 100vh;", css, StringComparison.Ordinal);
        Assert.Contains("#app { min-height: 100vh; }", css, StringComparison.Ordinal);
        Assert.DoesNotMatch(new Regex(@"(?m)^\s*(?:html|body|#app)\s*\{[^}]*overflow\s*:\s*hidden", RegexOptions.Singleline), css);
        Assert.Contains(".bl-table-wrap { overflow-x: auto;", css, StringComparison.Ordinal);
        Assert.DoesNotContain(".bl-public-home", css, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Startup_shell_waits_for_one_session_restore_and_uses_a_stable_loading_screen()
    {
        var app = Read("src/BloodLink.Web/App.razor");
        var document = Read("src/BloodLink.Web/wwwroot/index.html");
        var css = Read("src/BloodLink.Web/wwwroot/app.css");
        var gateStart = app.IndexOf("@if (!Initialization.IsInitialized)", StringComparison.Ordinal);
        var routeStart = app.IndexOf("<Router", StringComparison.Ordinal);
        var gateEnd = app.IndexOf("else", gateStart, StringComparison.Ordinal);

        Assert.True(gateStart >= 0 && gateEnd > gateStart && routeStart > gateEnd);
        Assert.Contains("Initialization.InitializeAsync(() => SessionRestore.RestoreAsync())", app, StringComparison.Ordinal);
        Assert.Contains("class=\"bl-startup-screen\"", app, StringComparison.Ordinal);
        Assert.Contains("class=\"bl-startup-screen\"", document, StringComparison.Ordinal);
        Assert.Contains("href=\"app.css\"", document, StringComparison.Ordinal);
        Assert.DoesNotContain("<style>", document, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("class=\"loading-progress\"", document, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"bl-page\"", app, StringComparison.Ordinal);
        Assert.Contains(".bl-startup-screen {", css, StringComparison.Ordinal);
        Assert.Contains("min-height: 100vh", css, StringComparison.Ordinal);
        Assert.Contains("@media (prefers-reduced-motion: reduce)", css, StringComparison.Ordinal);

        var gate = new BloodLink.Web.Services.Authentication.ApplicationInitializationGate();
        var releaseRestore = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var restoreCalls = 0;
        Task RestoreSlowly()
        {
            restoreCalls++;
            return releaseRestore.Task;
        }

        var firstInitialization = gate.InitializeAsync(RestoreSlowly);
        var repeatedInitialization = gate.InitializeAsync(RestoreSlowly);

        Assert.False(gate.IsInitialized);
        Assert.Same(firstInitialization, repeatedInitialization);
        Assert.Equal(1, restoreCalls);

        releaseRestore.SetResult();
        await firstInitialization;

        Assert.True(gate.IsInitialized);
        Assert.Equal(1, restoreCalls);
    }

    [Fact]
    public void Registration_keeps_both_standalone_route_contracts_and_uses_original_form_styles()
    {
        var registration = Read("src/BloodLink.Web/Pages/FacilityRegister.razor");

        Assert.Contains("@page \"/facility/register\"", registration, StringComparison.Ordinal);
        Assert.Contains("@page \"/facilities/register\"", registration, StringComparison.Ordinal);
        Assert.Contains("bl-form-card", registration, StringComparison.Ordinal);
        Assert.Contains("Facilities.Register(new(", registration, StringComparison.Ordinal);
        Assert.Contains("Form.AdminPassword = \"\"", registration, StringComparison.Ordinal);
    }

    [Fact]
    public void Bound_dropdowns_use_typed_selects_and_readable_native_color_scheme()
    {
        var registration = Read("src/BloodLink.Web/Pages/FacilityRegister.razor");
        var workspace = Read("src/BloodLink.Web/Pages/Workspace.razor");
        var css = Read("src/BloodLink.Web/wwwroot/app.css");

        Assert.Contains("<InputSelect class=\"bl-input bl-select\" @bind-Value=\"Form.FacilityType\">", registration, StringComparison.Ordinal);
        Assert.Contains("<option value=\"Hospital\">Hospital</option>", registration, StringComparison.Ordinal);
        Assert.Contains("<option value=\"BloodBank\">Blood bank</option>", registration, StringComparison.Ordinal);
        Assert.Contains("if (Busy) return;", registration, StringComparison.Ordinal);
        Assert.Contains("<InputSelect @bind-Value=\"SelectedBloodType\">", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"APositive\">A+</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"ONegative\">O-</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"Urgent\">Urgent</option>", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("<select ", registration, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<select ", workspace, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(".bl-select { appearance: auto; color: var(--bl-navy); color-scheme: light; }", css, StringComparison.Ordinal);
        Assert.Contains(".bl-panel select, .bl-toolbar select { color-scheme: light; }", css, StringComparison.Ordinal);
    }

    [Fact]
    public void Dashboards_use_role_specific_summary_fields_and_original_card_primitives()
    {
        var dashboard = Read("src/BloodLink.Web/Components/DashboardOverview.razor");
        var workspace = Read("src/BloodLink.Web/Pages/Workspace.razor");

        Assert.Contains("pendingFacilities", dashboard, StringComparison.Ordinal);
        Assert.Contains("openNeeds", dashboard, StringComparison.Ordinal);
        Assert.Contains("myOpenNeeds", dashboard, StringComparison.Ordinal);
        Assert.Contains("recentActivity", dashboard, StringComparison.Ordinal);
        Assert.Contains("bl-stat-grid", dashboard, StringComparison.Ordinal);
        Assert.Contains("<DashboardOverview Data=\"dashboardData\" />", workspace, StringComparison.Ordinal);
    }

    [Fact]
    public void Operational_views_use_typed_records_status_badges_and_timelines()
    {
        var records = Read("src/BloodLink.Web/Components/OperationalRecords.razor");
        var workspace = Read("src/BloodLink.Web/Pages/Workspace.razor");

        Assert.Contains("Paged<FacilityDto>", records, StringComparison.Ordinal);
        Assert.Contains("Paged<StaffDto>", records, StringComparison.Ordinal);
        Assert.Contains("Paged<InventoryTransactionDto>", records, StringComparison.Ordinal);
        Assert.Contains("Paged<AvailabilityDto>", records, StringComparison.Ordinal);
        Assert.Contains("Paged<NeedDto>", records, StringComparison.Ordinal);
        Assert.Contains("Paged<RequestDto>", records, StringComparison.Ordinal);
        Assert.Contains("Paged<NotificationDto>", records, StringComparison.Ordinal);
        Assert.Contains("bl-status-badge", records, StringComparison.Ordinal);
        Assert.Contains("bl-timeline-item", records, StringComparison.Ordinal);
        Assert.Contains("PageChanged=\"ChangePage\"", workspace, StringComparison.Ordinal);
        Assert.Contains("TimelineData", workspace, StringComparison.Ordinal);
    }

    [Fact]
    public void Authenticated_routes_enforce_role_appropriate_inventory_and_governance_access()
    {
        var workspace = Read("src/BloodLink.Web/Pages/Workspace.razor");
        var sidebar = Read("src/BloodLink.Web/Layout/DashboardSidebar.razor");

        Assert.Contains("if (Path.StartsWith(\"/system/facilities\")) return roles.Contains(\"SystemAdmin\")", workspace, StringComparison.Ordinal);
        Assert.Contains("Path == \"/inventory/history\"", workspace, StringComparison.Ordinal);
        Assert.Contains("Path == \"/inventory/search\"", workspace, StringComparison.Ordinal);
        Assert.Contains("if (!IsSystem)", sidebar, StringComparison.Ordinal);
        Assert.Contains("href=\"/facility/profile\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("href=\"/facility/staff\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("HandleKeyDown", sidebar, StringComparison.Ordinal);
        Assert.Contains("await _menuToggle.FocusAsync()", sidebar, StringComparison.Ordinal);
    }

    [Fact]
    public void Authenticated_production_verifier_prompts_securely_and_writes_only_sanitized_results()
    {
        var wrapper = Read("scripts/verification/verify-authenticated.ps1");
        var verifier = Read("scripts/verification/verify-authenticated.mjs");
        var package = Read("scripts/verification/package.json");
        var ignore = Read(".gitignore");

        Assert.Contains("Read-Host 'SystemAdmin password' -AsSecureString", wrapper, StringComparison.Ordinal);
        Assert.Contains("SecureStringToBSTR", wrapper, StringComparison.Ordinal);
        Assert.Contains("ZeroFreeBSTR", wrapper, StringComparison.Ordinal);
        Assert.DoesNotContain("Write-Host $plainPassword", wrapper, StringComparison.Ordinal);
        Assert.DoesNotContain("password =", package, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"verify:authenticated\": \"powershell -ExecutionPolicy Bypass -File ./verify-authenticated.ps1\"", package, StringComparison.Ordinal);
        Assert.Contains("mkdtemp(path.join(os.tmpdir(), 'bloodlink-auth-verification-'))", verifier, StringComparison.Ordinal);
        Assert.Contains("chromium.launchPersistentContext(userDataDir", verifier, StringComparison.Ordinal);
        Assert.Contains("context.on('serviceworker'", verifier, StringComparison.Ordinal);
        Assert.Contains("serviceWorkerEventsIgnored", verifier, StringComparison.Ordinal);
        Assert.Contains("await rm(userDataDir, { recursive: true, force: true })", verifier, StringComparison.Ordinal);
        Assert.Contains("production-authenticated-verification.json", verifier, StringComparison.Ordinal);
        Assert.Contains("logout-protected-route-denial", verifier, StringComparison.Ordinal);
        Assert.Contains("mobile-navigation-open-close", verifier, StringComparison.Ordinal);
        Assert.Contains("serviceWorkerController: null", verifier, StringComparison.Ordinal);
        Assert.Contains("screenshots: []", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("screenshot({", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("console.log(input.password", verifier, StringComparison.Ordinal);
        Assert.Contains("artifacts/ui-parity/", ignore, StringComparison.Ordinal);
    }

    [Fact]
    public void Production_verifier_uses_exact_heading_names_when_account_headings_overlap()
    {
        var verifier = Read("scripts/verification/verify-authenticated.mjs");
        var accountPage = Read("src/BloodLink.Web/Pages/Workspace.razor");

        Assert.Contains("getByRole('heading', { name: 'Account', exact: true })", verifier, StringComparison.Ordinal);
        Assert.Contains("<h1>@Title</h1>", accountPage, StringComparison.Ordinal);
        Assert.Contains("<h2 class=\"bl-card-title\">Account details</h2>", accountPage, StringComparison.Ordinal);
        Assert.DoesNotContain("getByRole('heading', { name: /account/i })", verifier, StringComparison.Ordinal);
    }

    [Fact]
    public void Production_startup_does_not_register_a_service_worker_or_enable_pwa_items()
    {
        var index = Read("src/BloodLink.Web/wwwroot/index.html");
        var project = Read("src/BloodLink.Web/BloodLink.Web.csproj");
        var appsettings = Read("src/BloodLink.Web/wwwroot/appsettings.json");

        Assert.Contains("bloodlink-sw-cleanup.js", index, StringComparison.Ordinal);
        Assert.DoesNotContain("navigator.serviceWorker.register", index, StringComparison.Ordinal);
        Assert.DoesNotContain("service-worker.js", index, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("manifest.webmanifest", index, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<ServiceWorkerAssetsManifest", project, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("service-worker.published.js", project, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("service-worker.js", project, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("manifest.webmanifest", project, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com", appsettings, StringComparison.Ordinal);
    }

    [Fact]
    public void Service_worker_cleanup_is_scoped_to_bloodlink_origin_and_cache_names()
    {
        var cleanup = Read("src/BloodLink.Web/wwwroot/bloodlink-sw-cleanup.js");
        var publicVerifier = Read("scripts/verification/verify-public.mjs");
        var cleanupVerifier = Read("scripts/verification/verify-service-worker-cleanup.mjs");

        Assert.Contains("window.location.origin", cleanup, StringComparison.Ordinal);
        Assert.Contains("registration.scope", cleanup, StringComparison.Ordinal);
        Assert.Contains("worker.scriptURL", cleanup, StringComparison.Ordinal);
        Assert.Contains("\"/service-worker.js\"", cleanup, StringComparison.Ordinal);
        Assert.Contains("\"/service-worker.published.js\"", cleanup, StringComparison.Ordinal);
        Assert.Contains("/^bloodlink/i", cleanup, StringComparison.Ordinal);
        Assert.Contains("/^offline-cache-/i", cleanup, StringComparison.Ordinal);
        Assert.Contains("caches.delete(name)", cleanup, StringComparison.Ordinal);
        Assert.DoesNotContain("sessionStorage.clear", cleanup, StringComparison.Ordinal);
        Assert.DoesNotContain("localStorage.clear", cleanup, StringComparison.Ordinal);
        Assert.Contains("window.bloodLinkServiceWorkerCleanup", publicVerifier, StringComparison.Ordinal);
        Assert.Contains("waitForTimeout(1000)", publicVerifier, StringComparison.Ordinal);
        Assert.Contains("after.registrations.length !== 0", cleanupVerifier, StringComparison.Ordinal);
        Assert.Contains("unrelated-cache-must-remain", cleanupVerifier, StringComparison.Ordinal);
        Assert.Contains("sessionStorage.setItem('bloodlink.cleanup.marker'", cleanupVerifier, StringComparison.Ordinal);
    }

    [Fact]
    public void Authenticated_verifier_uses_final_registration_and_controller_state_not_promise_or_worker_events()
    {
        var verifier = Read("scripts/verification/verify-authenticated.mjs");

        Assert.Contains("await navigator.serviceWorker.getRegistrations()", verifier, StringComparison.Ordinal);
        Assert.Contains("registrationCount: sameOrigin.length", verifier, StringComparison.Ordinal);
        Assert.Contains("controller: navigator.serviceWorker?.controller", verifier, StringComparison.Ordinal);
        Assert.Contains("forceReload: true", verifier, StringComparison.Ordinal);
        Assert.Contains("state.registrationCount !== 0 || state.controller !== null", verifier, StringComparison.Ordinal);
        Assert.Contains("sanitizeWorkerState(state)", verifier, StringComparison.Ordinal);
        Assert.Contains("profileDirectoryId: path.basename(userDataDir)", verifier, StringComparison.Ordinal);
        Assert.Contains("new URL(registration.scope).pathname", verifier, StringComparison.Ordinal);
        Assert.Contains("new URL(worker.scriptURL).pathname", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("serviceWorkers: navigator.serviceWorker?.getRegistrations().then", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("context.serviceWorkers()", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("workerEvents.length !== 0", verifier, StringComparison.Ordinal);
    }

    [Fact]
    public void Authenticated_verifier_handles_facility_governance_empty_populated_and_error_states()
    {
        var verifier = Read("scripts/verification/verify-authenticated.mjs");

        Assert.Contains("facilityGovernanceState(page)", verifier, StringComparison.Ordinal);
        Assert.Contains("loadingCompleted: !document.querySelector('.bl-loading-state')", verifier, StringComparison.Ordinal);
        Assert.Contains("emptyStatePresent", verifier, StringComparison.Ordinal);
        Assert.Contains("errorStatePresent", verifier, StringComparison.Ordinal);
        Assert.Contains("detailLinkCount", verifier, StringComparison.Ordinal);
        Assert.Contains("detailActionCount", verifier, StringComparison.Ordinal);
        Assert.Contains("apiObservations.facilityList.itemCount", verifier, StringComparison.Ordinal);
        Assert.Contains("Array.isArray(body?.items) ? body.items.length : null", verifier, StringComparison.Ordinal);
        Assert.Contains("api.itemCount === 0", verifier, StringComparison.Ordinal);
        Assert.Contains("facility-governance-detail-not-applicable-no-production-facilities", verifier, StringComparison.Ordinal);
        Assert.Contains("api.itemCount ?? 0", verifier, StringComparison.Ordinal);
        Assert.Contains("a[aria-label^=\"View \"][href^=\"/system/facilities/\"]", verifier, StringComparison.Ordinal);
        Assert.Contains("Facility list failed", verifier, StringComparison.Ordinal);
        Assert.Contains("Facility governance did not reach a terminal state", verifier, StringComparison.Ordinal);
        Assert.Contains("sanitizedFacilityDiagnostics", verifier, StringComparison.Ordinal);
        Assert.Contains("consoleOrPageErrors", verifier, StringComparison.Ordinal);
        Assert.Contains("apiStatus", verifier, StringComparison.Ordinal);
        Assert.Contains("apiFacilityCount", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("locator('a[href^=\"/system/facilities/\"]').first()", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("firstFacility.waitFor", verifier, StringComparison.Ordinal);
        Assert.DoesNotContain("allHeaders", verifier, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("response.text", verifier, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Release_publish_output_cannot_register_a_new_service_worker_when_present()
    {
        var publishRoot = Path.Combine(Root, "src/BloodLink.Web/bin/Release/net8.0/publish/wwwroot");
        if (!Directory.Exists(publishRoot)) return;

        var index = File.ReadAllText(Path.Combine(publishRoot, "index.html"));
        Assert.Contains("bloodlink-sw-cleanup.js", index, StringComparison.Ordinal);
        Assert.DoesNotContain("navigator.serviceWorker.register", index, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(publishRoot, "service-worker.js")), "Release publish output must not contain service-worker.js.");
        Assert.False(File.Exists(Path.Combine(publishRoot, "service-worker.published.js")), "Release publish output must not contain service-worker.published.js.");
        Assert.False(File.Exists(Path.Combine(publishRoot, "manifest.webmanifest")), "Release publish output must not contain manifest.webmanifest.");
        Assert.Contains("https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com", File.ReadAllText(Path.Combine(publishRoot, "appsettings.json")), StringComparison.Ordinal);
    }

    private static string Read(string relativePath) => File.ReadAllText(Path.Combine(Root, relativePath));

    private static string FindRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "BloodLink.Frontend.sln"))) return current.FullName;
            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the frontend repository root.");
    }
}
