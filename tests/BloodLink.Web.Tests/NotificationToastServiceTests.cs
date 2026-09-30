using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using BloodLink.Web.Models;
using BloodLink.Web.Services;
using BloodLink.Web.Services.Api;
using BloodLink.Web.Services.Authentication;

namespace BloodLink.Web.Tests;

public sealed class NotificationToastServiceTests
{
    private static readonly Guid FacilityId = Guid.Parse("91dce448-6d17-4ce9-94b1-82216b93c123");

    [Fact]
    public async Task Initial_baseline_does_not_replay_history_and_new_items_toast_once_without_changing_unread_state()
    {
        var old = Notification(1, 2, "New external blood request", "A facility requested blood.", "BloodRequest");
        var current = Notification(2, 2, "New external blood request", "A facility requested blood.", "BloodRequest");
        var handler = new NotificationHandler([old], [current, old], [current, old]);
        using var service = Create(handler, TimeSpan.FromDays(1));

        await service.StartAsync();
        Assert.Empty(service.Visible);

        await service.PollNowAsync();
        var toast = Assert.Single(service.Visible);
        Assert.Equal(current.Id, toast.Id);
        Assert.Equal("View request", toast.ActionLabel);
        Assert.Equal($"/requests/{current.RelatedEntityId}", toast.TargetPath);

        await service.PollNowAsync();
        Assert.Single(service.Visible);
        Assert.All(handler.Methods, method => Assert.Equal(HttpMethod.Get, method));
    }

    [Fact]
    public async Task Toasts_are_limited_to_three_sorted_newest_first_and_pending_items_are_promoted()
    {
        var notifications = Enumerable.Range(1, 5)
            .Select(index => Notification(index, 2, "New external blood request", "A facility requested blood.", "BloodRequest"))
            .ToArray();
        var handler = new NotificationHandler([], notifications);
        using var service = Create(handler, TimeSpan.FromDays(1));
        await service.StartAsync();
        await service.PollNowAsync();

        Assert.Equal(3, service.Visible.Count);
        Assert.Equal(new[] { notifications[4].Id, notifications[3].Id, notifications[2].Id }, service.Visible.Select(item => item.Id));

        service.Dismiss(notifications[4].Id);
        Assert.Equal(3, service.Visible.Count);
        Assert.Equal(notifications[3].Id, service.Visible[0].Id);
        Assert.Contains(service.Visible, item => item.Id == notifications[1].Id);
        service.Dismiss(notifications[1].Id);
        Assert.Equal(3, service.Visible.Count);
    }

    [Fact]
    public async Task Hover_and_keyboard_focus_pause_the_auto_dismiss_timer()
    {
        var current = Notification(1, 4, "Blood request fulfilled", "A handover is complete.", "BloodRequest");
        var handler = new NotificationHandler([], [current]);
        using var service = Create(handler, TimeSpan.FromMilliseconds(150));
        await service.StartAsync();
        await service.PollNowAsync();
        Assert.Single(service.Visible);

        service.SetHovered(current.Id, true);
        await Task.Delay(220);
        Assert.Single(service.Visible);
        service.SetFocused(current.Id, true);
        service.SetHovered(current.Id, false);
        await Task.Delay(220);
        Assert.Single(service.Visible);

        service.SetFocused(current.Id, false);
        await Task.Delay(220);
        Assert.Empty(service.Visible);
    }

    [Fact]
    public async Task Manual_dismiss_and_deep_link_do_not_mark_notification_read()
    {
        var current = Notification(1, 3, "Blood request accepted", "A source facility accepted the request.", "BloodRequest");
        var handler = new NotificationHandler([], [current]);
        using var service = Create(handler, TimeSpan.FromDays(1));
        await service.StartAsync();
        await service.PollNowAsync();

        var toast = Assert.Single(service.Visible);
        Assert.Equal(ToastSeverity.Success, toast.Severity);
        Assert.Equal("View request", toast.ActionLabel);
        Assert.Equal($"/requests/{current.RelatedEntityId}", toast.TargetPath);
        service.Dismiss(toast.Id);
        Assert.Empty(service.Visible);
        Assert.All(handler.Methods, method => Assert.Equal(HttpMethod.Get, method));
    }

    [Fact]
    public async Task Logout_stops_polling_and_clears_visible_toasts_without_expiry_toasts()
    {
        var current = Notification(1, 2, "New external blood request", "A facility requested blood.", "BloodRequest");
        var handler = new NotificationHandler([], [current], [Notification(2, 4, "Blood request fulfilled", "Done.", "BloodRequest")]);
        var session = NewSession();
        using var service = new NotificationToastService(session, Client(handler), TimeSpan.FromDays(1), TimeSpan.FromDays(1));
        await service.StartAsync();
        await service.PollNowAsync();
        Assert.Single(service.Visible);
        var callsBeforeLogout = handler.CallCount;

        Assert.True(session.TryBeginLogout());
        Assert.False(service.IsPolling);
        Assert.Empty(service.Visible);
        await service.PollNowAsync();

        Assert.Equal(callsBeforeLogout, handler.CallCount);
        Assert.DoesNotContain(handler.Methods, method => method == HttpMethod.Post);
    }

    [Fact]
    public async Task Unauthorized_notification_poll_does_not_create_a_toast_or_expiry_message()
    {
        var session = NewSession();
        var client = new NotificationApiClient(new HttpClient(new UnauthorizedHandler())
        { BaseAddress = new Uri("https://api.example.test/") });
        using var service = new NotificationToastService(session, client, TimeSpan.FromDays(1), TimeSpan.FromDays(1));

        await service.StartAsync();
        await service.PollNowAsync();

        Assert.Empty(service.Visible);
        Assert.NotNull(session.AccessToken);
        Assert.True(service.IsPolling);
    }

    [Fact]
    public async Task Disposing_the_toast_host_stops_the_poll_loop()
    {
        var handler = new NotificationHandler([], []);
        using var service = new NotificationToastService(NewSession(), Client(handler), TimeSpan.FromDays(1), TimeSpan.FromDays(1));
        await service.StartAsync();
        Assert.True(service.IsPolling);
        var callsBeforeStop = handler.CallCount;

        service.Stop();
        await service.PollNowAsync();

        Assert.False(service.IsPolling);
        Assert.Equal(callsBeforeStop, handler.CallCount);
    }

    [Fact]
    public async Task Restored_session_baselines_existing_notifications_again_without_replay()
    {
        var old = Notification(1, 2, "New external blood request", "Old request.", "BloodRequest");
        var handler = new NotificationHandler([old], [old]);
        var session = NewSession();
        using var firstService = new NotificationToastService(session, Client(handler), TimeSpan.FromDays(1), TimeSpan.FromDays(1));
        await firstService.StartAsync();
        Assert.Empty(firstService.Visible);
        firstService.Dispose();

        using var restoredService = new NotificationToastService(session, Client(handler), TimeSpan.FromDays(1), TimeSpan.FromDays(1));
        await restoredService.StartAsync();
        Assert.Empty(restoredService.Visible);
        await restoredService.PollNowAsync();
        Assert.Empty(restoredService.Visible);
    }

    [Theory]
    [InlineData(0, "Facility status updated", ToastSeverity.Error)]
    [InlineData(1, "New internal blood need", ToastSeverity.Information)]
    [InlineData(2, "New external blood request", ToastSeverity.Warning)]
    [InlineData(3, "Blood request accepted", ToastSeverity.Success)]
    [InlineData(3, "Blood request rejected", ToastSeverity.Warning)]
    [InlineData(3, "Blood request cancelled", ToastSeverity.Information)]
    [InlineData(4, "Blood request fulfilled", ToastSeverity.Success)]
    public async Task Important_notification_categories_use_their_severity(int category, string title, ToastSeverity severity)
    {
        var message = category == 0 ? "Your facility status is now Suspended." : "An operational notification.";
        var item = Notification(10, category, title, message, "BloodRequest");
        var handler = new NotificationHandler([], [item]);
        using var service = Create(handler, TimeSpan.FromDays(1));
        await service.StartAsync();
        await service.PollNowAsync();
        Assert.Equal(severity, Assert.Single(service.Visible).Severity);
    }

    [Fact]
    public async Task Categories_without_current_backend_notification_events_remain_center_only()
    {
        var items = new[]
        {
            Notification(11, 5, "Low stock alert", "No active notification event emits this category.", "BloodRequest"),
            Notification(12, 6, "Account created", "A staff account was created.", "FacilityStaff"),
            Notification(13, 7, "Security alert", "No active notification event emits this category.", "Facility")
        };
        var handler = new NotificationHandler([], items);
        using var service = Create(handler, TimeSpan.FromDays(1));
        await service.StartAsync();
        await service.PollNowAsync();
        Assert.Empty(service.Visible);
    }

    [Fact]
    public void Notification_history_and_read_controls_remain_in_the_workspace()
    {
        var sidebar = File.ReadAllText(FindRoot("src/BloodLink.Web/Layout/DashboardSidebar.razor"));
        var records = File.ReadAllText(FindRoot("src/BloodLink.Web/Components/OperationalRecords.razor"));
        var api = File.ReadAllText(FindRoot("src/BloodLink.Web/Services/Api/AuthApiClient.cs"));
        var toastService = File.ReadAllText(FindRoot("src/BloodLink.Web/Services/NotificationToastService.cs"));
        var toastHost = File.ReadAllText(FindRoot("src/BloodLink.Web/Components/NotificationToastHost.razor"));
        Assert.Contains("href=\"/notifications\"", sidebar, StringComparison.Ordinal);
        Assert.Contains("Data is Paged<NotificationDto>", records, StringComparison.Ordinal);
        Assert.Contains("Mark read", records, StringComparison.Ordinal);
        Assert.Contains("public Task<Paged<NotificationDto>> List", api, StringComparison.Ordinal);
        Assert.Contains("public Task MarkRead", api, StringComparison.Ordinal);
        Assert.Contains("aria-live=\"polite\"", toastHost, StringComparison.Ordinal);
        Assert.Contains("role=\"status\"", toastHost, StringComparison.Ordinal);
        Assert.Contains("Toasts.Navigate(toast, Navigation)", toastHost, StringComparison.Ordinal);
        Assert.Contains("MaximumVisible = 3", toastService, StringComparison.Ordinal);
        Assert.Contains("TimeSpan.FromSeconds(25)", toastService, StringComparison.Ordinal);
        Assert.Contains("session.TransitionChanged += OnSessionTransitionChanged", toastService, StringComparison.Ordinal);
        Assert.Contains("if (session.IsLogoutInProgress)", toastService, StringComparison.Ordinal);
        Assert.Contains("if (!baselineEstablished)", toastService, StringComparison.Ordinal);
    }

    private static NotificationToastService Create(NotificationHandler handler, TimeSpan toastLifetime) =>
        new(NewSession(), Client(handler), TimeSpan.FromDays(1), toastLifetime);

    private static SessionStore NewSession()
    {
        var session = new SessionStore();
        session.Set("test-access-token", new("test-user", "test@example.test", "Test", "User", FacilityId,
            ["FacilityAdmin"], FacilityStatus.Approved, false));
        return session;
    }

    private static NotificationApiClient Client(NotificationHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://api.example.test/") });

    private static NotificationDto Notification(int id, int type, string title, string message, string relatedType) =>
        new(Guid.Parse($"00000000-0000-0000-0000-{id:000000000000}"), type, title, message, false,
            DateTime.UtcNow.AddSeconds(id), relatedType,
            Guid.Parse("efb867d1-e8e5-4c37-bd95-892a77a90001"));

    private static string FindRoot(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "BloodLink.Frontend.sln")))
            current = current.Parent;
        return Path.Combine(current?.FullName ?? throw new DirectoryNotFoundException(), relativePath);
    }

    private sealed class NotificationHandler(params NotificationDto[][] responses) : HttpMessageHandler
    {
        private readonly ConcurrentQueue<NotificationDto[]> queued = new(responses);
        public int CallCount { get; private set; }
        public List<HttpMethod> Methods { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            Methods.Add(request.Method);
            if (request.Method != HttpMethod.Get || request.RequestUri?.AbsolutePath != "/api/v1/notifications")
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            if (!queued.TryDequeue(out var items)) items = [];
            var page = new Paged<NotificationDto>(items, 1, 25, false);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(page) });
        }
    }

    private sealed class UnauthorizedHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
    }
}
