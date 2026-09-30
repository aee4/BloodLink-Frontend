using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;

namespace BloodLink.Web.Services.Authentication;

public sealed class SessionStore(ISessionMaterialStore? materialStore = null)
{
    private long generation;
    private long logoutVersion;
    public string? AccessToken { get; private set; }
    public Models.ApiUser? User { get; private set; }
    public bool IsLogoutInProgress { get; private set; }
    public long Generation => generation;
    public long LogoutVersion => logoutVersion;
    public event Action? Changed;
    public event Action? TransitionChanged;

    public void Set(string token, Models.ApiUser user)
    {
        AccessToken = token;
        User = user;
        generation++;
        Changed?.Invoke();
    }

    public async Task SetAsync(string token, string refreshToken, Models.ApiUser user,
        CancellationToken cancellationToken = default)
    {
        if (materialStore is not null)
            await materialStore.WriteRefreshTokenAsync(refreshToken, cancellationToken);
        AccessToken = token;
        User = user;
        generation++;
        Changed?.Invoke();
    }

    public async Task<bool> TrySetIfCurrentAsync(string token, string refreshToken, Models.ApiUser user,
        long expectedGeneration, CancellationToken cancellationToken = default)
    {
        if (IsLogoutInProgress || generation != expectedGeneration) return false;
        if (materialStore is not null)
            await materialStore.WriteRefreshTokenAsync(refreshToken, cancellationToken);
        if (IsLogoutInProgress || generation != expectedGeneration)
        {
            if (materialStore is not null)
                await materialStore.ClearAsync(cancellationToken);
            return false;
        }

        AccessToken = token;
        User = user;
        generation++;
        Changed?.Invoke();
        return true;
    }

    public bool TryBeginLogout()
    {
        if (IsLogoutInProgress) return false;
        IsLogoutInProgress = true;
        generation++;
        logoutVersion++;
        TransitionChanged?.Invoke();
        return true;
    }

    public void EndLogout()
    {
        if (!IsLogoutInProgress) return;
        IsLogoutInProgress = false;
        TransitionChanged?.Invoke();
    }

    public Task<string?> ReadStoredRefreshTokenAsync(CancellationToken cancellationToken = default) =>
        materialStore?.ReadRefreshTokenAsync(cancellationToken) ?? Task.FromResult<string?>(null);

    public void UpdateUser(Models.ApiUser user)
    {
        User = user;
        Changed?.Invoke();
    }

    public void Clear()
    {
        var changed = AccessToken is not null || User is not null;
        AccessToken = null;
        User = null;
        if (changed)
        {
            generation++;
            Changed?.Invoke();
        }
    }

    public async Task ClearAsync(CancellationToken cancellationToken = default)
    {
        Clear();
        if (materialStore is not null)
            await materialStore.ClearAsync(cancellationToken);
    }

    public ClaimsPrincipal Principal
    {
        get
        {
            if (User is null) return new ClaimsPrincipal(new ClaimsIdentity());
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, User.Id),
                new(ClaimTypes.Name, $"{User.FirstName} {User.LastName}".Trim()),
                new(ClaimTypes.Email, User.Email)
            };
            claims.AddRange(User.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "BloodLinkBearer"));
        }
    }
}

public sealed class FrontendAuthenticationStateProvider : AuthenticationStateProvider, IDisposable
{
    private readonly SessionStore session;
    public FrontendAuthenticationStateProvider(SessionStore session)
    {
        this.session = session;
        session.Changed += Notify;
    }

    public override Task<AuthenticationState> GetAuthenticationStateAsync() =>
        Task.FromResult(new AuthenticationState(session.Principal));

    public void Dispose() => session.Changed -= Notify;
    private void Notify() => NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
}

public static class ReturnPath
{
    public static string LocalOrDashboard(string? value) => IsLocal(value) ? value! : "/dashboard";
    public static bool IsLocal(string? value) => !string.IsNullOrWhiteSpace(value)
        && value.StartsWith('/') && !value.StartsWith("//", StringComparison.Ordinal)
        && !value.Contains('\\') && !value.Any(char.IsControl)
        && Uri.TryCreate(value, UriKind.Relative, out _);
}
