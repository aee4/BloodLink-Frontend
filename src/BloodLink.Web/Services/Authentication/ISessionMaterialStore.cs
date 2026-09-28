namespace BloodLink.Web.Services.Authentication;

public interface ISessionMaterialStore
{
    Task<string?> ReadRefreshTokenAsync(CancellationToken cancellationToken = default);
    Task WriteRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task ClearAsync(CancellationToken cancellationToken = default);
}
