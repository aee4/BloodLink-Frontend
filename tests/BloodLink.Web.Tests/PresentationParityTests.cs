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
        Assert.Matches(new Regex("else\\s*\\{\\s*<NavLink class=\\\"bl-nav-item\\\" href=\\\"/inventory\\\""), sidebar);
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
