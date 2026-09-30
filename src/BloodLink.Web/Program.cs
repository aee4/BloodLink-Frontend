using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.AspNetCore.Components.Authorization;
using BloodLink.Web;
using BloodLink.Web.Services.Api;
using BloodLink.Web.Services.Authentication;
using BloodLink.Web.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var apiBaseUrl = builder.Configuration["Api:BaseUrl"] ?? "http://localhost:5249/";
if (!Uri.TryCreate(apiBaseUrl, UriKind.Absolute, out var apiUri) || apiUri.Scheme is not ("http" or "https"))
    throw new InvalidOperationException("Api:BaseUrl must be an absolute HTTP or HTTPS URL.");
builder.Services.AddAuthorizationCore();
builder.Services.AddScoped<ISessionMaterialStore, BrowserSessionMaterialStore>();
builder.Services.AddScoped<SessionStore>();
builder.Services.AddScoped<AuthenticationStateProvider, FrontendAuthenticationStateProvider>();
builder.Services.AddScoped(sp => new SessionRefreshService(
    new HttpClient(new HttpClientHandler()) { BaseAddress = apiUri },
    sp.GetRequiredService<SessionStore>()));
builder.Services.AddScoped<SessionRestoreService>();
builder.Services.AddScoped<ApplicationInitializationGate>();
builder.Services.AddScoped<BearerHandler>();
builder.Services.AddScoped(sp =>
{
    var handler = sp.GetRequiredService<BearerHandler>();
    handler.InnerHandler = new HttpClientHandler();
    return new HttpClient(handler) { BaseAddress = apiUri };
});
builder.Services.AddScoped<AuthApiClient>();
builder.Services.AddScoped<FacilityApiClient>();
builder.Services.AddScoped<StaffApiClient>();
builder.Services.AddScoped<InventoryApiClient>();
builder.Services.AddScoped<NeedApiClient>();
builder.Services.AddScoped<RequestApiClient>();
builder.Services.AddScoped<NotificationApiClient>();
builder.Services.AddScoped(sp => new NotificationToastService(
    sp.GetRequiredService<SessionStore>(),
    sp.GetRequiredService<NotificationApiClient>()));
builder.Services.AddScoped<DashboardApiClient>();

await builder.Build().RunAsync();
