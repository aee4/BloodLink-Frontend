using System.Net.Http.Json;
using BloodLink.Web.Models;
using BloodLink.Web.Services.Api;

namespace BloodLink.Web.Services.Authentication;

public sealed class SessionRefreshService(HttpClient refreshHttp, SessionStore session) : IDisposable
{
    private readonly SemaphoreSlim refreshGate = new(1, 1);

    public async Task<bool> RestoreAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var refreshToken = await session.ReadStoredRefreshTokenAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(refreshToken)) return false;
            return await RefreshAsync(null, cancellationToken);
        }
        catch
        {
            await ClearSessionAsync(cancellationToken);
            return false;
        }
    }

    public async Task<bool> RefreshAsync(string? failedAccessToken, CancellationToken cancellationToken = default)
    {
        await refreshGate.WaitAsync(cancellationToken);
        try
        {
            if (failedAccessToken is not null && session.AccessToken != failedAccessToken)
                return session.AccessToken is not null;

            var refreshToken = await session.ReadStoredRefreshTokenAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                await ClearSessionAsync(cancellationToken);
                return false;
            }

            using var response = await refreshHttp.PostAsJsonAsync("api/v1/auth/refresh",
                new RefreshBody(refreshToken), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                await ClearSessionAsync(cancellationToken);
                return false;
            }

            var refreshed = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: cancellationToken);
            if (refreshed is null || string.IsNullOrWhiteSpace(refreshed.AccessToken)
                || string.IsNullOrWhiteSpace(refreshed.RefreshToken))
            {
                await ClearSessionAsync(cancellationToken);
                return false;
            }

            await session.SetAsync(refreshed.AccessToken, refreshed.RefreshToken, refreshed.User, cancellationToken);
            return true;
        }
        catch
        {
            await ClearSessionAsync(cancellationToken);
            return false;
        }
        finally
        {
            refreshGate.Release();
        }
    }

    private async Task ClearSessionAsync(CancellationToken cancellationToken)
    {
        try { await session.ClearAsync(cancellationToken); }
        catch { session.Clear(); }
    }

    private sealed record RefreshBody(string RefreshToken);

    public void Dispose()
    {
        refreshGate.Dispose();
        refreshHttp.Dispose();
    }
}

public sealed class SessionRestoreService(SessionRefreshService refresh, AuthApiClient auth, SessionStore session)
{
    public async Task RestoreAsync(CancellationToken cancellationToken = default)
    {
        if (!await refresh.RestoreAsync(cancellationToken)) return;
        try
        {
            session.UpdateUser(await auth.Current(cancellationToken));
        }
        catch
        {
            try { await session.ClearAsync(cancellationToken); }
            catch { session.Clear(); }
        }
    }
}
