using System.Text.RegularExpressions;

namespace BloodLink.Web.Tests;

public sealed class MobileOperationalLayoutTests
{
    private static string Read(string path)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "BloodLink.Frontend.sln")))
            directory = directory.Parent;
        return File.ReadAllText(Path.Combine(directory!.FullName, path));
    }

    [Fact]
    public void All_shared_record_cells_have_mobile_labels_and_explicit_need_actions()
    {
        var records = Read("src/BloodLink.Web/Components/OperationalRecords.razor");
        var tables = Regex.Matches(records, "<table class=\"bl-table bl-record-table\">.*?</table>", RegexOptions.Singleline);
        Assert.Equal(6, tables.Count);
        foreach (Match table in tables)
        {
            foreach (Match cell in Regex.Matches(table.Value, "<td[^>]*>"))
                Assert.Contains("data-label=", cell.Value, StringComparison.Ordinal);
        }
        // The unchanged backend list payload can omit the optional presentation deadline.
        var options = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        var payload = "{\"id\":\"00000000-0000-0000-0000-000000000001\",\"bloodType\":0,\"unitsNeeded\":1,\"status\":0}";
        var need = System.Text.Json.JsonSerializer.Deserialize<BloodLink.Web.Models.NeedDto>(payload, options)!;
        Assert.Null(need.NeededByUtc);
        Assert.Equal(1, need.UnitsNeeded);
        var withDeadline = payload[..^1] + ",\"neededByUtc\":\"2026-10-04T23:55:00Z\"}";
        var datedNeed = System.Text.Json.JsonSerializer.Deserialize<BloodLink.Web.Models.NeedDto>(withDeadline, options)!;
        Assert.Equal(DateTimeKind.Utc, datedNeed.NeededByUtc!.Value.Kind);
        Assert.Contains("View details</a>", records, StringComparison.Ordinal);
        Assert.Contains("item.NeededByUtc?", records, StringComparison.Ordinal);
        Assert.Contains("&rarr;", records, StringComparison.Ordinal);
        Assert.DoesNotContain("<a href=\"@($\"/needs/{item.Id}\")\"><span", records, StringComparison.Ordinal);
    }

    [Fact]
    public void Mobile_grid_rule_follows_desktop_rule_and_removes_forced_table_width()
    {
        var css = Read("src/BloodLink.Web/wwwroot/app.css");
        var desktop = css.IndexOf("grid-template-columns: minmax(0, 2fr) minmax(15rem, 1fr)", StringComparison.Ordinal);
        var mobile = css.LastIndexOf(".bl-detail-grid { grid-template-columns: minmax(0, 1fr); }", StringComparison.Ordinal);
        Assert.True(desktop >= 0 && mobile > desktop);
        Assert.Contains("@media (max-width: 768px)", css[..mobile], StringComparison.Ordinal);
        Assert.DoesNotContain("min-width: 42rem", css, StringComparison.Ordinal);
        Assert.DoesNotContain("word-break: break-all", css, StringComparison.Ordinal);
        Assert.Contains(".bl-record-table tbody tr { display: grid;", css, StringComparison.Ordinal);
        Assert.Contains(".bl-detail-main, .bl-detail-aside { width: 100%; min-width: 0; }", css, StringComparison.Ordinal);
        Assert.Contains(".bl-request-table { display: none; }", css, StringComparison.Ordinal);
        Assert.Contains(".bl-request-cards { display: grid; }", css, StringComparison.Ordinal);
    }

    [Fact]
    public void Browser_regressions_check_real_geometry_and_all_requested_widths()
    {
        var verifier = Read("scripts/verification/verify-mobile-operational.mjs");
        Assert.Contains("[320, 360, 375, 390, 430, 768, 1440]", verifier, StringComparison.Ordinal);
        Assert.Contains("geometry.document <= geometry.viewport", verifier, StringComparison.Ordinal);
        Assert.Contains("history.y >= details.y + details.height", verifier, StringComparison.Ordinal);
        Assert.Contains("narrowFields", verifier, StringComparison.Ordinal);
        Assert.Contains("clippedActions", verifier, StringComparison.Ordinal);
        Assert.Contains("['light', 'dark']", verifier, StringComparison.Ordinal);
        Assert.Contains("This verifier requires a local frontend.", verifier, StringComparison.Ordinal);
    }
}
