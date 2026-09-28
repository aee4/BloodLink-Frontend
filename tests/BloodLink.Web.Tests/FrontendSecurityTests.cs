using System.Net;
using BloodLink.Web;
using BloodLink.Web.Services.Api;
using BloodLink.Web.Services.Authentication;

namespace BloodLink.Web.Tests;

public sealed class FrontendSecurityTests
{
    [Theory]
    [InlineData("/needs/mine", true)]
    [InlineData("/account/login?returnUrl=%2Fdashboard", true)]
    [InlineData("https://attacker.example", false)]
    [InlineData("//attacker.example/path", false)]
    [InlineData("/\\attacker.example", false)]
    [InlineData("/dashboard\r\nLocation:evil", false)]
    public void Return_path_only_accepts_local_paths(string candidate, bool expected) =>
        Assert.Equal(expected, ReturnPath.IsLocal(candidate));

    [Fact]
    public void Invalid_return_path_falls_back_to_dashboard() =>
        Assert.Equal("/dashboard", ReturnPath.LocalOrDashboard("https://attacker.example"));

    [Fact]
    public void Session_roles_are_exposed_and_clear_removes_identity()
    {
        var session = new SessionStore();
        session.Set("opaque-token", new("user-1", "person@example.test", "A", "User", Guid.NewGuid(), ["FacilityAdmin"], null, false));
        Assert.Equal("opaque-token", session.AccessToken);
        Assert.True(session.Principal.IsInRole("FacilityAdmin"));
        session.Clear();
        Assert.Null(session.AccessToken);
        Assert.False(session.Principal.Identity!.IsAuthenticated);
    }

    [Fact]
    public void Compiled_route_table_contains_required_routes()
    {
        var routes = typeof(App).Assembly.GetTypes()
            .SelectMany(type => type.GetCustomAttributesData())
            .Where(attribute => attribute.AttributeType.FullName == "Microsoft.AspNetCore.Components.RouteAttribute")
            .Select(attribute => attribute.ConstructorArguments[0].Value as string)
            .Where(template => template is not null).ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Contains("/account/login", routes);
        Assert.Contains("/dashboard", routes);
        Assert.Contains("/facilities/register", routes);
        Assert.Contains("/facility/profile", routes);
        Assert.Contains("/facility/staff/create", routes);
        Assert.Contains("/system/facilities", routes);
        Assert.Contains("/inventory/adjust", routes);
        Assert.Contains("/needs/new", routes);
        Assert.Contains("/needs/{RecordId:guid}", routes);
        Assert.Contains("/requests/sent", routes);
        Assert.Contains("/requests/received", routes);
        Assert.Contains("/notifications", routes);
    }

    [Fact]
    public async Task Api_errors_hide_backend_details_and_validation_values()
    {
        var handler = new StubHandler(_ => new(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("{\"errors\":{\"Password\":[\"Do not disclose this validation detail\"]},\"detail\":\"database-secret\"}")
        });
        var client = new TestApiClient(new HttpClient(handler) { BaseAddress = new Uri("https://backend.example/") });

        var error = await Assert.ThrowsAsync<ApiException>(() => client.Read());

        Assert.Equal(HttpStatusCode.BadRequest, error.StatusCode);
        Assert.Contains("Password", error.Fields.Keys);
        Assert.Contains("Check this field.", error.Fields["Password"]);
        Assert.DoesNotContain("database-secret", error.Message);
        Assert.DoesNotContain("Do not disclose", error.Message);
    }

    [Fact]
    public async Task Forbidden_and_conflict_responses_have_safe_messages()
    {
        foreach (var (status, expected) in new[]
        {
            (HttpStatusCode.Forbidden, "does not have permission"),
            (HttpStatusCode.Conflict, "Reload and try again")
        })
        {
            var client = new TestApiClient(new HttpClient(new StubHandler(_ => new(status)
            {
                Content = new StringContent("internal server data")
            }))
            { BaseAddress = new Uri("https://backend.example/") });
            var error = await Assert.ThrowsAsync<ApiException>(() => client.Read());
            Assert.Contains(expected, error.Message);
            Assert.DoesNotContain("internal server", error.Message);
        }
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "session has expired")]
    [InlineData(HttpStatusCode.NotFound, "no longer exists")]
    [InlineData(HttpStatusCode.TooManyRequests, "Too many requests")]
    [InlineData(HttpStatusCode.ServiceUnavailable, "try again later")]
    public async Task Common_api_statuses_map_to_safe_user_messages(HttpStatusCode status, string expected)
    {
        var client = new TestApiClient(new HttpClient(new StubHandler(_ => new(status)
        {
            Content = new StringContent("password-reset-token and stack trace")
        }))
        { BaseAddress = new Uri("https://backend.example/") });

        var error = await Assert.ThrowsAsync<ApiException>(() => client.Read());

        Assert.Contains(expected, error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password-reset-token", error.Message);
        Assert.DoesNotContain("stack trace", error.Message);
    }

    [Fact]
    public async Task Api_client_honours_cancellation()
    {
        var client = new TestApiClient(new HttpClient(new StubHandler(_ => new(HttpStatusCode.OK)))
        {
            BaseAddress = new Uri("https://backend.example/")
        });
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.Read(cancellation.Token));
    }

    private sealed class TestApiClient(HttpClient http) : BackendApiClient(http)
    {
        public Task<string> Read(CancellationToken cancellationToken = default) => Get<string>("api/v1/test", cancellationToken);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(response(request));
    }
}
