using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Components;

namespace BloodLink.Web.Services.Authentication;

public sealed class BearerHandler(SessionStore session, SessionRefreshService refresh, NavigationManager navigation) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var sentAccessToken = session.AccessToken;
        var body = request.Content is null ? null : await request.Content.ReadAsByteArrayAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(sentAccessToken))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sentAccessToken);

        var response = await base.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized && sentAccessToken is not null)
        {
            if (await refresh.RefreshAsync(sentAccessToken, cancellationToken))
            {
                response.Dispose();
                using var retry = CloneRequest(request, body, session.AccessToken!);
                return await base.SendAsync(retry, cancellationToken);
            }

            NavigateToLogin();
        }
        return response;
    }

    private static HttpRequestMessage CloneRequest(HttpRequestMessage request, byte[]? body, string accessToken)
    {
        var retry = new HttpRequestMessage(request.Method, request.RequestUri)
        {
            Version = request.Version,
            VersionPolicy = request.VersionPolicy
        };
        foreach (var header in request.Headers)
            retry.Headers.TryAddWithoutValidation(header.Key, header.Value);
        if (body is not null)
        {
            retry.Content = new ByteArrayContent(body);
            if (request.Content is not null)
                foreach (var header in request.Content.Headers)
                    retry.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }
        retry.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return retry;
    }

    private void NavigateToLogin()
    {
        var current = "/" + navigation.ToBaseRelativePath(navigation.Uri);
        var returnUrl = ReturnPath.IsLocal(current) ? current : "/dashboard";
        navigation.NavigateTo($"/account/login?returnUrl={Uri.EscapeDataString(returnUrl)}");
    }
}
