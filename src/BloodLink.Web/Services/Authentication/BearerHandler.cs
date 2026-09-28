using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Components;

namespace BloodLink.Web.Services.Authentication;

public sealed class BearerHandler(SessionStore session, NavigationManager navigation) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(session.AccessToken))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var response = await base.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized && session.AccessToken is not null)
        {
            session.Clear();
            var current = "/" + navigation.ToBaseRelativePath(navigation.Uri);
            var returnUrl = ReturnPath.IsLocal(current) ? current : "/dashboard";
            navigation.NavigateTo($"/account/login?returnUrl={Uri.EscapeDataString(returnUrl)}");
        }
        return response;
    }
}
