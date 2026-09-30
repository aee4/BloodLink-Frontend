using BloodLink.Web.Models;
using BloodLink.Web.Services.Api;
using BloodLink.Web.Services.Authentication;
using Microsoft.AspNetCore.Components;

namespace BloodLink.Web.Services;

public enum ToastSeverity { Information, Success, Warning, Error }

public sealed record NotificationToast(
    Guid Id,
    string Title,
    string Message,
    ToastSeverity Severity,
    string? ActionLabel,
    string? TargetPath,
    DateTime CreatedAtUtc);

public sealed class NotificationToastService : IDisposable
{
    private const int MaximumVisible = 3;
    private readonly SessionStore session;
    private readonly NotificationApiClient notifications;
    private readonly TimeSpan pollInterval;
    private readonly TimeSpan toastLifetime;
    private readonly HashSet<Guid> seenIds = [];
    private readonly Dictionary<Guid, ToastTimer> timers = [];
    private readonly List<NotificationToast> visible = [];
    private readonly LinkedList<NotificationToast> pending = [];
    private CancellationTokenSource? pollCancellation;
    private Task? pollTask;
    private string? activeUserId;
    private bool baselineEstablished;
    private bool started;
    private bool disposed;

    public NotificationToastService(SessionStore session, NotificationApiClient notifications,
        TimeSpan? pollInterval = null, TimeSpan? toastLifetime = null)
    {
        this.session = session;
        this.notifications = notifications;
        this.pollInterval = pollInterval ?? TimeSpan.FromSeconds(25);
        this.toastLifetime = toastLifetime ?? TimeSpan.FromSeconds(6);
    }

    public event Action? Changed;
    public IReadOnlyList<NotificationToast> Visible => visible.ToArray();
    public bool IsPolling => pollTask is { IsCompleted: false } && activeUserId is not null;
    public bool IsBaselineEstablished => baselineEstablished;

    public async Task StartAsync()
    {
        if (disposed) return;
        if (!started)
        {
            started = true;
            session.Changed += OnSessionChanged;
            session.TransitionChanged += OnSessionTransitionChanged;
        }

        await SynchronizeSessionAsync(waitForBaseline: true);
    }

    public async Task PollNowAsync(CancellationToken cancellationToken = default)
    {
        var userId = activeUserId;
        var token = pollCancellation?.Token ?? new CancellationToken(true);
        if (userId is null || !IsCurrentSession(userId) || token.IsCancellationRequested) return;
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(token, cancellationToken);
        await PollOnceAsync(userId, linked.Token);
    }

    public void Dismiss(Guid id)
    {
        if (visible.RemoveAll(item => item.Id == id) > 0)
        {
            StopToastTimer(id);
            PromotePending();
            Changed?.Invoke();
        }
        else
        {
            var node = pending.First;
            while (node is not null)
            {
                var next = node.Next;
                if (node.Value.Id == id) pending.Remove(node);
                node = next;
            }
        }
    }

    public void SetHovered(Guid id, bool value) => SetPaused(id, hovered: value);
    public void SetFocused(Guid id, bool value) => SetPaused(id, focused: value);

    public void Navigate(NotificationToast toast, NavigationManager navigation)
    {
        if (string.IsNullOrWhiteSpace(toast.TargetPath)) return;
        Dismiss(toast.Id);
        navigation.NavigateTo(toast.TargetPath);
    }

    public void Stop()
    {
        if (started)
        {
            session.Changed -= OnSessionChanged;
            session.TransitionChanged -= OnSessionTransitionChanged;
            started = false;
        }
        StopPolling(clearToasts: true);
        activeUserId = null;
        baselineEstablished = false;
    }

    private async Task SynchronizeSessionAsync(bool waitForBaseline)
    {
        var userId = session.User?.Id;
        if (session.IsLogoutInProgress || userId is null || string.IsNullOrWhiteSpace(session.AccessToken))
        {
            StopPolling(clearToasts: true);
            activeUserId = null;
            baselineEstablished = false;
            return;
        }

        if (activeUserId == userId && pollCancellation is { IsCancellationRequested: false }) return;

        StopPolling(clearToasts: true);
        activeUserId = userId;
        baselineEstablished = false;
        seenIds.Clear();
        pollCancellation = new CancellationTokenSource();
        var cancellationToken = pollCancellation.Token;
        Task? initialPoll = null;
        if (waitForBaseline)
            await PollOnceAsync(userId, cancellationToken);
        else
            initialPoll = PollOnceAsync(userId, cancellationToken);
        pollTask = PollLoopAsync(userId, cancellationToken, initialPoll);
    }

    private async Task PollLoopAsync(string userId, CancellationToken cancellationToken, Task? initialPoll)
    {
        try
        {
            if (initialPoll is not null) await initialPoll;
            while (!cancellationToken.IsCancellationRequested && IsCurrentSession(userId))
            {
                await Task.Delay(pollInterval, cancellationToken);
                await PollOnceAsync(userId, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
    }

    private async Task PollOnceAsync(string userId, CancellationToken cancellationToken)
    {
        if (!IsCurrentSession(userId) || cancellationToken.IsCancellationRequested) return;
        Paged<NotificationDto> result;
        try
        {
            result = await notifications.List(1, cancellationToken);
        }
        catch (ApiException)
        {
            // BearerHandler owns refresh/expiry behavior. Poll failures never create toast errors.
            return;
        }
        catch (HttpRequestException)
        {
            return;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return;
        }
        catch (OperationCanceledException)
        {
            // A timed-out background poll is retried on the next interval without affecting auth state.
            return;
        }

        if (!IsCurrentSession(userId) || cancellationToken.IsCancellationRequested) return;
        if (!baselineEstablished)
        {
            foreach (var notification in result.Items) Remember(notification.Id);
            baselineEstablished = true;
            return;
        }

        foreach (var notification in result.Items.OrderByDescending(item => item.CreatedAtUtc).ThenBy(item => item.Id))
        {
            if (!seenIds.Add(notification.Id)) continue;
            if (seenIds.Count > 1000) seenIds.Remove(seenIds.First());
            if (TryCreateToast(notification) is { } toast) Queue(toast);
        }
    }

    private NotificationToast? TryCreateToast(NotificationDto item)
    {
        if (!Enum.IsDefined(typeof(NotificationCategory), item.NotificationType)) return null;
        var category = (NotificationCategory)item.NotificationType;
        if (category is NotificationCategory.AccountCreated or NotificationCategory.LowStock or NotificationCategory.Security)
            return null;

        var severity = category switch
        {
            NotificationCategory.RequestFulfilled => ToastSeverity.Success,
            NotificationCategory.RequestResponse when item.Title.Contains("accepted", StringComparison.OrdinalIgnoreCase) => ToastSeverity.Success,
            NotificationCategory.RequestResponse when item.Title.Contains("rejected", StringComparison.OrdinalIgnoreCase) => ToastSeverity.Warning,
            NotificationCategory.RequestResponse when item.Title.Contains("cancel", StringComparison.OrdinalIgnoreCase) => ToastSeverity.Information,
            NotificationCategory.NewExternalRequest => ToastSeverity.Warning,
            NotificationCategory.FacilityDecision when IsSuspension(item) => ToastSeverity.Error,
            _ => ToastSeverity.Information
        };

        var target = item.RelatedEntityId is not Guid id ? null : item.RelatedEntityType switch
        {
            "BloodRequest" => $"/requests/{id}",
            "BloodNeed" => $"/needs/{id}",
            "Facility" when session.User?.Roles.Contains("SystemAdmin") == true => $"/system/facilities/{id}",
            "Facility" when session.User?.Roles.Contains("FacilityAdmin") == true => "/facility/profile",
            "FacilityStaff" when session.User?.Roles.Contains("FacilityAdmin") == true => "/facility/staff",
            _ => null
        };
        var action = target switch
        {
            null => null,
            var path when path.StartsWith("/requests/", StringComparison.Ordinal) => "View request",
            var path when path.StartsWith("/needs/", StringComparison.Ordinal) => "View need",
            var path when path.StartsWith("/system/facilities/", StringComparison.Ordinal) => "View facility",
            _ => "View details"
        };
        return new(item.Id, item.Title, item.Message, severity, action, target, item.CreatedAtUtc);
    }

    private static bool IsSuspension(NotificationDto item) =>
        item.Title.Contains("suspend", StringComparison.OrdinalIgnoreCase)
        || item.Message.Contains("suspend", StringComparison.OrdinalIgnoreCase);

    private void Queue(NotificationToast toast)
    {
        if (visible.Count < MaximumVisible)
        {
            visible.Insert(0, toast);
            StartToastTimer(toast.Id);
        }
        else
        {
            var node = pending.First;
            while (node is not null && node.Value.CreatedAtUtc >= toast.CreatedAtUtc) node = node.Next;
            if (node is null) pending.AddLast(toast);
            else pending.AddBefore(node, toast);
        }
        visible.Sort((left, right) => right.CreatedAtUtc.CompareTo(left.CreatedAtUtc));
        Changed?.Invoke();
    }

    private void PromotePending()
    {
        while (visible.Count < MaximumVisible && pending.First is { } first)
        {
            pending.RemoveFirst();
            visible.Insert(0, first.Value);
            StartToastTimer(first.Value.Id);
        }
        visible.Sort((left, right) => right.CreatedAtUtc.CompareTo(left.CreatedAtUtc));
    }

    private void SetPaused(Guid id, bool? hovered = null, bool? focused = null)
    {
        if (!timers.TryGetValue(id, out var timer)) return;
        var wasPaused = timer.IsPaused;
        if (hovered.HasValue) timer.Hovered = hovered.Value;
        if (focused.HasValue) timer.Focused = focused.Value;
        if (wasPaused == timer.IsPaused) return;
        if (timer.IsPaused) PauseTimer(timer);
        else ResumeTimer(timer);
    }

    private void StartToastTimer(Guid id)
    {
        StopToastTimer(id);
        var timer = new ToastTimer(id, toastLifetime);
        timers[id] = timer;
        ResumeTimer(timer);
    }

    private void PauseTimer(ToastTimer timer)
    {
        if (timer.Cancellation is null) return;
        timer.Remaining -= timer.Elapsed.Elapsed;
        timer.Cancellation.Cancel();
        timer.Cancellation.Dispose();
        timer.Cancellation = null;
    }

    private void ResumeTimer(ToastTimer timer)
    {
        if (timer.IsPaused || timer.Cancellation is not null) return;
        timer.Cancellation = new CancellationTokenSource();
        timer.Elapsed = System.Diagnostics.Stopwatch.StartNew();
        _ = ExpireToastAsync(timer, timer.Cancellation.Token);
    }

    private async Task ExpireToastAsync(ToastTimer timer, CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(timer.Remaining, cancellationToken);
            if (!cancellationToken.IsCancellationRequested) Dismiss(timer.Id);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
    }

    private void StopToastTimer(Guid id)
    {
        if (!timers.Remove(id, out var timer)) return;
        timer.Cancellation?.Cancel();
        timer.Cancellation?.Dispose();
    }

    private bool IsCurrentSession(string userId) =>
        !disposed && !session.IsLogoutInProgress && session.AccessToken is not null
        && string.Equals(session.User?.Id, userId, StringComparison.Ordinal);

    private void Remember(Guid id)
    {
        seenIds.Add(id);
        if (seenIds.Count > 1000) seenIds.Remove(seenIds.First());
    }

    private void OnSessionChanged() => _ = SynchronizeSessionAsync(waitForBaseline: false);

    private void OnSessionTransitionChanged()
    {
        if (session.IsLogoutInProgress)
        {
            StopPolling(clearToasts: true);
            return;
        }
        _ = SynchronizeSessionAsync(waitForBaseline: false);
    }

    private void StopPolling(bool clearToasts)
    {
        pollCancellation?.Cancel();
        pollCancellation?.Dispose();
        pollCancellation = null;
        pollTask = null;
        if (!clearToasts) return;
        foreach (var id in timers.Keys.ToArray()) StopToastTimer(id);
        visible.Clear();
        pending.Clear();
        Changed?.Invoke();
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        Stop();
    }

    private enum NotificationCategory
    {
        FacilityDecision = 0,
        NewNeed = 1,
        NewExternalRequest = 2,
        RequestResponse = 3,
        RequestFulfilled = 4,
        LowStock = 5,
        AccountCreated = 6,
        Security = 7
    }

    private sealed class ToastTimer(Guid id, TimeSpan lifetime)
    {
        public Guid Id { get; } = id;
        public TimeSpan Remaining { get; set; } = lifetime;
        public bool Hovered { get; set; }
        public bool Focused { get; set; }
        public bool IsPaused => Hovered || Focused;
        public System.Diagnostics.Stopwatch Elapsed { get; set; } = new();
        public CancellationTokenSource? Cancellation { get; set; }
    }
}
