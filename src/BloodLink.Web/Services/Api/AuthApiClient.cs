using BloodLink.Web.Models;
using BloodLink.Web.Services.Authentication;
using System.Net;

namespace BloodLink.Web.Services.Api;

public sealed class AuthApiClient(HttpClient http, SessionStore session) : BackendApiClient(http)
{
    public async Task<ApiUser> Login(string email, string password, CancellationToken cancellationToken = default)
    {
        var response = await Post<LoginBody, TokenResponse>("api/v1/auth/login", new(email, password), cancellationToken);
        try
        {
            await session.SetAsync(response.AccessToken, response.RefreshToken, response.User, cancellationToken);
        }
        catch
        {
            try { await session.ClearAsync(cancellationToken); }
            catch { session.Clear(); }
            throw new ApiException(HttpStatusCode.ServiceUnavailable, "Secure session storage is unavailable. Try again later.");
        }
        return response.User;
    }

    public Task<ApiUser> Current(CancellationToken cancellationToken = default) => Get<ApiUser>("api/v1/auth/me", cancellationToken);

    public async Task Logout(CancellationToken cancellationToken = default)
    {
        try { await Post("api/v1/auth/logout", cancellationToken); }
        finally
        {
            try { await session.ClearAsync(cancellationToken); }
            catch { session.Clear(); }
        }
    }

    public async Task ChangePassword(string current, string next, CancellationToken cancellationToken = default)
    {
        await Post("api/v1/auth/change-password", new { currentPassword = current, newPassword = next }, cancellationToken);
        try { await session.ClearAsync(cancellationToken); }
        catch { session.Clear(); }
    }

    private sealed record LoginBody(string Email, string Password);
}

public sealed class FacilityApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<FacilityDto> Register(RegistrationRequest request, CancellationToken ct = default) =>
        Post<RegistrationRequest, FacilityDto>("api/v1/facilities/register", request, ct);
    public Task<FacilityDto> Mine(CancellationToken ct = default) => Get<FacilityDto>("api/v1/facilities/me", ct);
    public Task Update(FacilityUpdateRequest body, CancellationToken ct = default) => Put("api/v1/facilities/me", body, ct);
    public Task<Paged<FacilityDto>> SystemList(int status, int page = 1, CancellationToken ct = default) =>
        Get<Paged<FacilityDto>>($"api/v1/system/facilities?status={status}&page={page}&pageSize=25", ct);
    public Task<FacilityDto> SystemGet(Guid id, CancellationToken ct = default) => Get<FacilityDto>($"api/v1/system/facilities/{id}", ct);
    public Task Approve(Guid id, CancellationToken ct = default) => Post($"api/v1/system/facilities/{id}/approve", ct);
    public Task Reject(Guid id, string reason, CancellationToken ct = default) => Post($"api/v1/system/facilities/{id}/reject", new { reason }, ct);
    public Task Suspend(Guid id, string reason, CancellationToken ct = default) => Post($"api/v1/system/facilities/{id}/suspend", new { reason }, ct);
    public Task Restore(Guid id, CancellationToken ct = default) => Post($"api/v1/system/facilities/{id}/restore", ct);
}

public sealed class StaffApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<Paged<StaffDto>> List(int page = 1, CancellationToken ct = default) => Get<Paged<StaffDto>>($"api/v1/staff?page={page}&pageSize=25", ct);
    public Task<StaffDto> Create(StaffCreateRequest body, CancellationToken ct = default) => Post<StaffCreateRequest, StaffDto>("api/v1/staff", body, ct);
    public Task Activate(string id, CancellationToken ct = default) => Post($"api/v1/staff/{Uri.EscapeDataString(id)}/activate", ct);
    public Task Deactivate(string id, string reason, CancellationToken ct = default) => Post($"api/v1/staff/{Uri.EscapeDataString(id)}/deactivate", new { reason }, ct);
}

public sealed class InventoryApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<IReadOnlyList<InventoryItemDto>> List(CancellationToken ct = default) => Get<IReadOnlyList<InventoryItemDto>>("api/v1/inventory", ct);
    public Task Adjust(InventoryAdjustmentRequest body, CancellationToken ct = default) => Post("api/v1/inventory/adjustments", body, ct);
    public Task<Paged<InventoryTransactionDto>> History(int page = 1, CancellationToken ct = default) => Get<Paged<InventoryTransactionDto>>($"api/v1/inventory/history?page={page}&pageSize=25", ct);
    public Task<Paged<AvailabilityDto>> Search(BloodType bloodType, int minimum, int page = 1, CancellationToken ct = default) => Get<Paged<AvailabilityDto>>($"api/v1/inventory/search?bloodType={(int)bloodType}&minimumAvailableUnits={minimum}&page={page}&pageSize=25", ct);
    public Task<IReadOnlyList<LowStockDto>> LowStock(CancellationToken ct = default) => Get<IReadOnlyList<LowStockDto>>("api/v1/inventory/low-stock", ct);
}

public sealed class NeedApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<NeedDto> Create(NeedCreateRequest body, CancellationToken ct = default) => Post<NeedCreateRequest, NeedDto>("api/v1/needs", body, ct);
    public Task<Paged<NeedDto>> Mine(int page = 1, CancellationToken ct = default) => Get<Paged<NeedDto>>($"api/v1/needs/mine?page={page}&pageSize=25", ct);
    public Task<Paged<NeedDto>> List(int page = 1, CancellationToken ct = default) => Get<Paged<NeedDto>>($"api/v1/needs?page={page}&pageSize=25", ct);
    public Task<NeedDetailDto> Get(Guid id, CancellationToken ct = default) => base.Get<NeedDetailDto>($"api/v1/needs/{id}", ct);
    public Task<IReadOnlyList<NeedTimelineDto>> Timeline(Guid id, CancellationToken ct = default) => Get<IReadOnlyList<NeedTimelineDto>>($"api/v1/needs/{id}/timeline", ct);
    public Task StartSearch(Guid id, CancellationToken ct = default) => Post($"api/v1/needs/{id}/start-search", ct);
    public Task Fulfil(Guid id, string? reason, CancellationToken ct = default) => Post($"api/v1/needs/{id}/fulfil-internally", new { reason }, ct);
    public Task Reject(Guid id, string? reason, CancellationToken ct = default) => Post($"api/v1/needs/{id}/reject", new { reason }, ct);
    public Task Cancel(Guid id, string? reason, CancellationToken ct = default) => Post($"api/v1/needs/{id}/cancel", new { reason }, ct);
}

public sealed class RequestApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<RequestDto> Create(RequestCreateRequest body, CancellationToken ct = default) => Post<RequestCreateRequest, RequestDto>("api/v1/requests", body, ct);
    public Task<Paged<RequestDto>> Sent(int page = 1, CancellationToken ct = default) => Get<Paged<RequestDto>>($"api/v1/requests/sent?page={page}&pageSize=25", ct);
    public Task<Paged<RequestDto>> Received(int page = 1, CancellationToken ct = default) => Get<Paged<RequestDto>>($"api/v1/requests/received?page={page}&pageSize=25", ct);
    public Task<RequestDto> Get(Guid id, CancellationToken ct = default) => base.Get<RequestDto>($"api/v1/requests/{id}", ct);
    public Task<IReadOnlyList<RequestTimelineDto>> Timeline(Guid id, CancellationToken ct = default) => Get<IReadOnlyList<RequestTimelineDto>>($"api/v1/requests/{id}/timeline", ct);
    public Task Accept(Guid id, int units, string? note, CancellationToken ct = default) => Post($"api/v1/requests/{id}/accept", new { unitsAccepted = units, responseNote = note }, ct);
    public Task Reject(Guid id, string? note, CancellationToken ct = default) => Post($"api/v1/requests/{id}/reject", new { unitsAccepted = (int?)null, responseNote = note }, ct);
    public Task Cancel(Guid id, CancellationToken ct = default) => Post($"api/v1/requests/{id}/cancel", ct);
    public Task Fulfil(Guid id, string? note, CancellationToken ct = default) => Post($"api/v1/requests/{id}/fulfil", new { note }, ct);
}

public sealed class NotificationApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<Paged<NotificationDto>> List(int page = 1, CancellationToken ct = default) => Get<Paged<NotificationDto>>($"api/v1/notifications?page={page}&pageSize=25", ct);
    public Task<UnreadCountDto> Unread(CancellationToken ct = default) => Get<UnreadCountDto>("api/v1/notifications/unread-count", ct);
    public Task MarkRead(Guid id, CancellationToken ct = default) => Post($"api/v1/notifications/{id}/read", ct);
    public Task MarkAllRead(CancellationToken ct = default) => Post("api/v1/notifications/read-all", ct);
}

public sealed class DashboardApiClient(HttpClient http) : BackendApiClient(http)
{
    public Task<System.Text.Json.JsonElement> GetDashboard(CancellationToken ct = default) => Get<System.Text.Json.JsonElement>("api/v1/dashboard", ct);
}
