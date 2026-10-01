using System.Text.Json;
using System.Net.Http.Json;
using BloodLink.Web.Services;
using BloodLink.Web.Models;
using BloodLink.Web.Services.Api;

namespace BloodLink.Web.Tests;

public sealed class DashboardActivityPresentationTests
{
    [Fact]
    public void Latest_five_handles_empty_short_exact_and_long_lists()
    {
        Assert.Empty(DashboardActivityPresentation.LatestFive([]));
        Assert.Equal(3, DashboardActivityPresentation.LatestFive(Events(3)).Count);
        Assert.Equal(5, DashboardActivityPresentation.LatestFive(Events(5)).Count);
        Assert.Equal(5, DashboardActivityPresentation.LatestFive(Events(8)).Count);
    }

    [Fact]
    public void Latest_five_are_explicitly_sorted_newest_first()
    {
        var items = Events(8).Reverse().ToArray();

        var latest = DashboardActivityPresentation.LatestFive(items);

        Assert.Equal(
            ["Event 7", "Event 6", "Event 5", "Event 4", "Event 3"],
            latest.Select(Action).ToArray());
    }

    [Fact]
    public void Timestamp_assumes_utc_for_zone_less_values_and_formats_in_requested_timezone()
    {
        using var document = JsonDocument.Parse("""{"createdAtUtc":"2026-09-30T14:00:37.2146729","action":"Login"}""");

        var timestamp = DashboardActivityPresentation.FormatTimestamp(document.RootElement, TimeZoneInfo.Utc);

        Assert.Equal("30 Sep 2026, 2:00 PM", timestamp);
        Assert.DoesNotContain("T", timestamp, StringComparison.Ordinal);
        Assert.DoesNotContain(".", timestamp, StringComparison.Ordinal);
        Assert.DoesNotContain("2026-09-30T14:00:37.2146729", timestamp, StringComparison.Ordinal);
    }

    [Fact]
    public void Timestamp_offsets_are_normalized_and_machine_value_is_valid_for_time_element()
    {
        using var document = JsonDocument.Parse("""{"createdAtUtc":"2026-09-30T16:00:00+02:00"}""");

        Assert.Equal("2026-09-30T14:00:00.0000000+00:00", DashboardActivityPresentation.MachineTimestamp(document.RootElement));
        Assert.Equal("30 Sep 2026, 2:00 PM", DashboardActivityPresentation.FormatTimestamp(document.RootElement, TimeZoneInfo.Utc));
    }

    [Fact]
    public void Typed_activity_timestamps_use_the_same_local_time_convention()
    {
        var utc = new DateTime(2026, 9, 30, 14, 0, 37, DateTimeKind.Utc);

        Assert.Equal(utc.ToLocalTime().ToString("dd MMM yyyy, h:mm tt", System.Globalization.CultureInfo.InvariantCulture),
            DashboardActivityPresentation.FormatTimestamp(utc));
        Assert.DoesNotContain("T", DashboardActivityPresentation.FormatTimestamp(utc), StringComparison.Ordinal);
        Assert.Equal("Account login", DashboardActivityPresentation.DisplayAction("AccountLogin"));
        Assert.Equal("Blood need status changed", DashboardActivityPresentation.DisplayAction("BloodNeedStatusChanged"));
        Assert.Equal("Inventory adjusted", DashboardActivityPresentation.DisplayAction("InventoryAdjusted"));
        Assert.Equal("Blood request accepted", DashboardActivityPresentation.DisplayAction("BloodRequestAccepted"));
    }

    [Fact]
    public void Dashboard_card_renders_only_stable_recent_items_with_readable_time_elements()
    {
        var component = File.ReadAllText(Path.Combine(FindRoot(), "src/BloodLink.Web/Components/DashboardActivityCard.razor"));

        Assert.Contains("DashboardActivityPresentation.LatestFive(Items)", component, StringComparison.Ordinal);
        Assert.Contains("DashboardActivityPresentation.FormatTimestamp(item)", component, StringComparison.Ordinal);
        Assert.Contains("<time class=\"bl-dash-time\"", component, StringComparison.Ordinal);
        Assert.Contains("No recent activity.", component, StringComparison.Ordinal);
        Assert.Contains("href=\"/activity\">View all activity</NavLink>", component, StringComparison.Ordinal);
        Assert.Contains("DashboardActivityPresentation.DisplayAction(item)", component, StringComparison.Ordinal);

        var items = Events(8);
        Assert.Equal(
            DashboardActivityPresentation.LatestFive(items).Select(Action),
            DashboardActivityPresentation.LatestFive(items).Select(Action));
    }

    [Fact]
    public async Task Activity_history_state_loads_pages_and_enforces_previous_next_bounds()
    {
        var requests = new List<string>();
        using var client = new HttpClient(new ActivityHandler(requests, page =>
            new Paged<DashboardActivityDto>(page == 1 ? [Event("First")] : [Event("Second")], page, 25, page == 1)))
        { BaseAddress = new Uri("https://api.example/") };
        var state = new ActivityHistoryState(new DashboardApiClient(client));

        await state.LoadPageAsync(1);
        Assert.Equal(1, state.PageNumber);
        Assert.False(state.CanGoPrevious);
        Assert.True(state.CanGoNext);

        await state.LoadPageAsync(2);
        Assert.Equal(2, state.PageNumber);
        Assert.True(state.CanGoPrevious);
        Assert.False(state.CanGoNext);
        Assert.Equal(["api/v1/activity?page=1&pageSize=25", "api/v1/activity?page=2&pageSize=25"], requests);
        Assert.Equal("Second", state.Result!.Items.Single().Summary);
    }

    [Fact]
    public async Task Activity_history_state_supports_empty_result_and_presents_api_errors()
    {
        using var emptyClient = new HttpClient(new ActivityHandler([], _ => new Paged<DashboardActivityDto>([], 1, 25, false)))
        { BaseAddress = new Uri("https://api.example/") };
        var emptyState = new ActivityHistoryState(new DashboardApiClient(emptyClient));
        await emptyState.LoadPageAsync(1);
        Assert.Empty(emptyState.Result!.Items);
        Assert.False(emptyState.CanGoPrevious);
        Assert.False(emptyState.CanGoNext);

        using var errorClient = new HttpClient(new ActivityErrorHandler()) { BaseAddress = new Uri("https://api.example/") };
        var errorState = new ActivityHistoryState(new DashboardApiClient(errorClient));
        await errorState.LoadPageAsync(1);
        Assert.Equal("Your account does not have permission to do that.", errorState.ErrorMessage);

        using var singlePageClient = new HttpClient(new ActivityHandler([], _ => new Paged<DashboardActivityDto>([Event("Only page")], 1, 25, false)))
        { BaseAddress = new Uri("https://api.example/") };
        var singlePageState = new ActivityHistoryState(new DashboardApiClient(singlePageClient));
        await singlePageState.LoadPageAsync(1);
        Assert.False(singlePageState.CanGoPrevious);
        Assert.False(singlePageState.CanGoNext);
    }

    [Fact]
    public void Activity_history_page_is_authorized_responsive_and_uses_shared_timestamp_formatter()
    {
        var page = File.ReadAllText(Path.Combine(FindRoot(), "src/BloodLink.Web/Pages/ActivityHistory.razor"));
        var css = File.ReadAllText(Path.Combine(FindRoot(), "src/BloodLink.Web/wwwroot/app.css"));

        Assert.Contains("@page \"/activity\"", page, StringComparison.Ordinal);
        Assert.Contains("@attribute [Authorize]", page, StringComparison.Ordinal);
        Assert.Contains("Roles.Any(role => role is \"SystemAdmin\" or \"FacilityAdmin\")", page, StringComparison.Ordinal);
        Assert.Contains("No activity yet", page, StringComparison.Ordinal);
        Assert.Contains("role=\"status\"", page, StringComparison.Ordinal);
        Assert.Contains("role=\"alert\"", page, StringComparison.Ordinal);
        Assert.Contains("Try again", page, StringComparison.Ordinal);
        Assert.Contains("disabled=\"@(!_state.CanGoPrevious)\"", page, StringComparison.Ordinal);
        Assert.Contains("disabled=\"@(!_state.CanGoNext)\"", page, StringComparison.Ordinal);
        Assert.Contains("_state.PageNumber - 1", page, StringComparison.Ordinal);
        Assert.Contains("_state.PageNumber + 1", page, StringComparison.Ordinal);
        Assert.Contains("DashboardActivityPresentation.FormatTimestamp(item.CreatedAtUtc)", page, StringComparison.Ordinal);
        Assert.Contains(".bl-activity-pagination", css, StringComparison.Ordinal);
        Assert.Contains("@media (max-width: 480px)", css, StringComparison.Ordinal);
        Assert.DoesNotContain("@item.CreatedAtUtc", page, StringComparison.Ordinal);
    }

    private static IReadOnlyList<JsonElement> Events(int count)
    {
        var events = new List<JsonElement>(count);
        for (var index = 0; index < count; index++)
        {
            using var document = JsonDocument.Parse($"{{\"action\":\"Event {index}\",\"createdAtUtc\":\"2026-09-30T14:{index:00}:00Z\"}}");
            events.Add(document.RootElement.Clone());
        }

        return events;
    }

    private static string Action(JsonElement item) => item.GetProperty("action").GetString()!;

    private static DashboardActivityDto Event(string summary) =>
        new("AccountLogin", summary, new DateTime(2026, 9, 30, 14, 0, 0, DateTimeKind.Utc), "User", null);

    private sealed class ActivityHandler(List<string> requests, Func<int, Paged<DashboardActivityDto>> resultFactory) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.PathAndQuery.TrimStart('/');
            requests.Add(path);
            var query = System.Web.HttpUtility.ParseQueryString(request.RequestUri.Query);
            var page = int.Parse(query["page"]!, System.Globalization.CultureInfo.InvariantCulture);
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = JsonContent.Create(resultFactory(page))
            });
        }
    }

    private sealed class ActivityErrorHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.Forbidden)
            {
                Content = JsonContent.Create(new { code = "forbidden" })
            });
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "BloodLink.Frontend.sln")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new DirectoryNotFoundException("Could not locate the BloodLink solution root.");
    }
}
