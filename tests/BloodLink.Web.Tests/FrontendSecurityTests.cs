using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using BloodLink.Web.Models;
using BloodLink.Web;
using BloodLink.Web.Services.Api;
using BloodLink.Web.Services.Authentication;
using Microsoft.AspNetCore.Components;

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
    public async Task Login_keeps_access_token_in_memory_and_persists_only_refresh_material()
    {
        var storage = new MemorySessionMaterialStore();
        var session = new SessionStore(storage);
        var user = NewUser();
        var http = new HttpClient(new StubHandler(_ => JsonResponse(TokenJson("access-secret", "refresh-secret", user))))
        { BaseAddress = new Uri("https://api.example.test/") };
        var auth = new AuthApiClient(http, session);

        await auth.Login(user.Email, "test-password");

        Assert.Equal("access-secret", session.AccessToken);
        Assert.Null(typeof(SessionStore).GetProperty("RefreshToken"));
        Assert.Equal("refresh-secret", storage.Value);
        Assert.DoesNotContain("access-secret", storage.Value, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Startup_restores_rotated_refresh_material_and_loads_current_user()
    {
        var storage = new MemorySessionMaterialStore { Value = "refresh-before" };
        var session = new SessionStore(storage);
        var refreshedUser = NewUser("current@example.test");
        using var refresher = new SessionRefreshService(
            new HttpClient(new StubHandler(_ => JsonResponse(TokenJson("access-new", "refresh-after", NewUser("stale@example.test")))))
            { BaseAddress = new Uri("https://api.example.test/") }, session);
        var auth = new AuthApiClient(new HttpClient(new StubHandler(_ => JsonResponse(JsonSerializer.Serialize(refreshedUser))))
        { BaseAddress = new Uri("https://api.example.test/") }, session);
        var restore = new SessionRestoreService(refresher, auth, session);

        await restore.RestoreAsync();

        Assert.Equal("access-new", session.AccessToken);
        Assert.Equal("refresh-after", storage.Value);
        Assert.Equal("current@example.test", session.User!.Email);
    }

    [Fact]
    public async Task Parallel_unauthorized_requests_share_one_refresh_and_retry_once_each()
    {
        var storage = new MemorySessionMaterialStore { Value = "refresh-old" };
        var session = new SessionStore(storage);
        session.Set("access-old", NewUser());
        var refreshCount = 0;
        using var refresh = new SessionRefreshService(new HttpClient(new StubHandler(_ =>
        {
            Interlocked.Increment(ref refreshCount);
            return JsonResponse(TokenJson("access-new", "refresh-new", NewUser()));
        }))
        { BaseAddress = new Uri("https://api.example.test/") }, session);
        var sentTokens = new List<string?>();
        var firstUnauthorizedRequests = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var initialCount = 0;
        var backend = new AsyncStubHandler(async request =>
        {
            lock (sentTokens) sentTokens.Add(request.Headers.Authorization?.Parameter);
            if (request.Headers.Authorization?.Parameter == "access-old")
            {
                if (Interlocked.Increment(ref initialCount) == 2) firstUnauthorizedRequests.TrySetResult();
                await firstUnauthorizedRequests.Task.WaitAsync(TimeSpan.FromSeconds(5));
                return new(HttpStatusCode.Unauthorized);
            }
            return new(HttpStatusCode.OK);
        });
        using var client = new HttpClient(new BearerHandler(session, refresh, new TestNavigationManager())
        {
            InnerHandler = backend
        });

        var responses = await Task.WhenAll(client.GetAsync("https://api.example.test/one"),
            client.GetAsync("https://api.example.test/two"));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        Assert.Equal(1, refreshCount);
        Assert.Equal(4, sentTokens.Count);
        Assert.Equal(2, sentTokens.Count(token => token == "access-old"));
        Assert.Equal(2, sentTokens.Count(token => token == "access-new"));
        Assert.Equal("refresh-new", storage.Value);
    }

    [Fact]
    public async Task Failed_refresh_clears_memory_and_session_storage()
    {
        var storage = new MemorySessionMaterialStore { Value = "expired-refresh" };
        var session = new SessionStore(storage);
        session.Set("expired-access", NewUser());
        using var refresh = new SessionRefreshService(
            new HttpClient(new StubHandler(_ => new(HttpStatusCode.Unauthorized)))
            { BaseAddress = new Uri("https://api.example.test/") }, session);

        Assert.False(await refresh.RefreshAsync("expired-access"));
        Assert.Null(session.AccessToken);
        Assert.Null(storage.Value);
    }

    [Fact]
    public async Task Logout_clears_all_browser_session_material()
    {
        var storage = new MemorySessionMaterialStore { Value = "refresh-value" };
        var session = new SessionStore(storage);
        session.Set("access-value", NewUser());
        await storage.WriteRefreshTokenAsync("refresh-value");
        var auth = new AuthApiClient(new HttpClient(new StubHandler(_ => new(HttpStatusCode.NoContent)))
        { BaseAddress = new Uri("https://api.example.test/") }, session);

        await auth.Logout();

        Assert.Null(session.AccessToken);
        Assert.Null(session.User);
        Assert.Null(storage.Value);
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
            (HttpStatusCode.Conflict, "current record or state")
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

    [Fact]
    public async Task Login_unauthorized_response_is_not_reported_as_an_expired_session()
    {
        var client = new TestApiClient(new HttpClient(new StubHandler(_ => new(HttpStatusCode.Unauthorized)))
        {
            BaseAddress = new Uri("https://backend.example/")
        });

        var error = await Assert.ThrowsAsync<ApiException>(() => client.Read("api/v1/auth/login"));

        Assert.Equal(HttpStatusCode.Unauthorized, error.StatusCode);
        Assert.Equal("Unable to sign in with these credentials.", error.Message);
        Assert.DoesNotContain("session has expired", error.Message, StringComparison.OrdinalIgnoreCase);
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
        public Task<string> Read(CancellationToken cancellationToken = default) => Read("api/v1/test", cancellationToken);
        public Task<string> Read(string path, CancellationToken cancellationToken = default) => Get<string>(path, cancellationToken);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(response(request));
    }

    private sealed class AsyncStubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            response(request);
    }

    private static ApiUser NewUser(string email = "person@example.test") =>
        new("user-1", email, "A", "User", Guid.NewGuid(), ["FacilityAdmin"], FacilityStatus.Approved, false);

    private static string TokenJson(string access, string refresh, ApiUser user) => JsonSerializer.Serialize(new
    {
        accessToken = access,
        tokenType = "Bearer",
        expiresIn = 900,
        refreshToken = refresh,
        refreshTokenExpiresAtUtc = DateTime.UtcNow.AddDays(14),
        user
    });

    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
    };

    private sealed class MemorySessionMaterialStore : ISessionMaterialStore
    {
        public string? Value { get; set; }
        public Task<string?> ReadRefreshTokenAsync(CancellationToken cancellationToken = default) => Task.FromResult(Value);
        public Task WriteRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
        { Value = refreshToken; return Task.CompletedTask; }
        public Task ClearAsync(CancellationToken cancellationToken = default)
        { Value = null; return Task.CompletedTask; }
    }

    private sealed class TestNavigationManager : NavigationManager
    {
        public TestNavigationManager() => Initialize("https://frontend.example/", "https://frontend.example/needs/new");
        protected override void NavigateToCore(string uri, bool forceLoad) { }
    }
}
