using System.Net;
using System.Text;
using BloodLink.Web.Models;
using BloodLink.Web.Services.Api;

namespace BloodLink.Web.Tests;

public sealed class SystemFacilityFilterTests
{
    [Theory]
    [InlineData(FacilityStatus.Approved, "status=1&page=1&pageSize=25")]
    [InlineData(FacilityStatus.Suspended, "status=3&page=1&pageSize=25")]
    [InlineData(FacilityStatus.Pending, "status=0&page=1&pageSize=25")]
    [InlineData(FacilityStatus.Rejected, "status=2&page=1&pageSize=25")]
    public async Task System_facility_filter_uses_numeric_enum_query_values(FacilityStatus status, string expectedQuery)
    {
        var handler = new CaptureHandler();
        var client = new FacilityApiClient(new HttpClient(handler) { BaseAddress = new Uri("https://api.example.test/") });

        await client.SystemList((int)status);

        Assert.Equal($"/api/v1/system/facilities?{expectedQuery}", handler.PathAndQuery);
    }

    [Fact]
    public async Task System_facility_all_filter_omits_status_query_parameter()
    {
        var handler = new CaptureHandler();
        var client = new FacilityApiClient(new HttpClient(handler) { BaseAddress = new Uri("https://api.example.test/") });

        await client.SystemList(null);

        Assert.Equal("/api/v1/system/facilities?page=1&pageSize=25", handler.PathAndQuery);
    }

    [Fact]
    public void System_facility_filter_binds_all_legacy_values_and_ignores_stale_load_responses()
    {
        var workspace = File.ReadAllText(FindRoot("src/BloodLink.Web/Pages/Workspace.razor"));
        var records = File.ReadAllText(FindRoot("src/BloodLink.Web/Components/OperationalRecords.razor"));

        Assert.Contains("ValueChanged=\"ChangeFacilityStatusFilter\"", workspace, StringComparison.Ordinal);
        Assert.Contains("private async Task ChangeFacilityStatusFilter(int? status)", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"\">All</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"1\">Active</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"3\">Suspended</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"0\">Legacy pending</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("<option value=\"2\">Rejected (legacy)</option>", workspace, StringComparison.Ordinal);
        Assert.Contains("Interlocked.Increment(ref loadGeneration)", workspace, StringComparison.Ordinal);
        Assert.Contains("generation != Volatile.Read(ref loadGeneration)", workspace, StringComparison.Ordinal);
        Assert.Contains("FacilityStatus.Approved => \"Active\"", records, StringComparison.Ordinal);
        Assert.Contains("FacilityStatus.Rejected => \"Rejected (legacy)\"", records, StringComparison.Ordinal);
    }

    private static string FindRoot(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "BloodLink.Frontend.sln")))
            current = current.Parent;
        return Path.Combine(current?.FullName ?? throw new DirectoryNotFoundException(), relativePath);
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        public string? PathAndQuery { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            PathAndQuery = request.RequestUri?.PathAndQuery;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"items\":[],\"pageNumber\":1,\"pageSize\":25,\"hasNext\":false}", Encoding.UTF8, "application/json")
            });
        }
    }
}
