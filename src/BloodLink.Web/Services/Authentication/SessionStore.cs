using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;

namespace BloodLink.Web.Services.Authentication;

public sealed class SessionStore(ISessionMaterialStore? materialStore = null)
{
    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }
    public Models.ApiUser? User { get; private set; }
    public event Action? Changed;

    public void Set(string token, Models.ApiUser user)
    {
        AccessToken = token;
        RefreshToken = null;
        User = user;
        Changed?.Invoke();
    }

    public void Set(string token, string refreshToken, Models.ApiUser user)
    {
        AccessToken = token;
        RefreshToken = refreshToken;
        User = user;
        Changed?.Invoke();
    }

    public async Task SetAsync(string token, string refreshToken, Models.ApiUser user,
        CancellationToken cancellationToken = default)
    {
        if (materialStore is not null)
            await materialStore.WriteRefreshTokenAsync(refreshToken, cancellationToken);
        AccessToken = token;
        RefreshToken = refreshToken;
        User = user;
        Changed?.Invoke();
    }

    public Task<string?> ReadStoredRefreshTokenAsync(CancellationToken cancellationToken = default) =>
        materialStore?.ReadRefreshTokenAsync(cancellationToken) ?? Task.FromResult<string?>(null);

    public void SetRefreshToken(string refreshToken) => RefreshToken = refreshToken;

    public void UpdateUser(Models.ApiUser user)
    {
        User = user;
        Changed?.Invoke();
    }

    public void Clear()
    {
        AccessToken = null;
        RefreshToken = null;
        User = null;
        Changed?.Invoke();
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
