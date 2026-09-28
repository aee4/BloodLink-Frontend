using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BloodLink.Web.Services.Api;

public sealed class ApiException(HttpStatusCode statusCode, string userMessage, IReadOnlyDictionary<string, string[]>? fields = null)
    : Exception(userMessage)
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public IReadOnlyDictionary<string, string[]> Fields { get; } = fields ?? new Dictionary<string, string[]>();
}

public abstract class BackendApiClient(HttpClient http)
{
    protected async Task<T> Get<T>(string path, CancellationToken cancellationToken = default) =>
        await Send<T>(new HttpRequestMessage(HttpMethod.Get, path), cancellationToken);

    protected async Task<T> Post<TBody, T>(string path, TBody body, CancellationToken cancellationToken = default) =>
        await Send<T>(new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) }, cancellationToken);

    protected async Task Post<TBody>(string path, TBody body, CancellationToken cancellationToken = default) =>
        await Send<object>(new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) }, cancellationToken);

    protected async Task Post(string path, CancellationToken cancellationToken = default) =>
        await Send<object>(new HttpRequestMessage(HttpMethod.Post, path), cancellationToken);

    protected async Task Put<TBody>(string path, TBody body, CancellationToken cancellationToken = default) =>
        await Send<object>(new HttpRequestMessage(HttpMethod.Put, path) { Content = JsonContent.Create(body) }, cancellationToken);

    private async Task<T> Send<T>(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using (request)
        using (var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
        {
            if (!response.IsSuccessStatusCode) throw await CreateException(response, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NoContent || typeof(T) == typeof(object)) return default!;
            try
            {
                return (await response.Content.ReadFromJsonAsync<T>(cancellationToken: cancellationToken))!;
            }
            catch (JsonException)
            {
                throw new ApiException(response.StatusCode, "The server returned an unexpected response. Please try again.");
            }
        }
    }

    private static async Task<ApiException> CreateException(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        IReadOnlyDictionary<string, string[]> fields = new Dictionary<string, string[]>();
        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            try
            {
                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (document.RootElement.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Object)
                    fields = errors.EnumerateObject().ToDictionary(property => property.Name, _ => new[] { "Check this field." });
            }
            catch (JsonException) { }
        }

        var message = response.StatusCode switch
        {
            HttpStatusCode.BadRequest => "Check the entered values and try again.",
            HttpStatusCode.Unauthorized => "Your session has expired. Sign in again.",
            HttpStatusCode.Forbidden => "Your account does not have permission to do that.",
            HttpStatusCode.NotFound => "This record is unavailable or no longer exists.",
            HttpStatusCode.Conflict => "This record changed or its current status prevents that action. Reload and try again.",
            HttpStatusCode.TooManyRequests => "Too many requests. Wait a moment and try again.",
            _ => "BloodLink could not complete that request. Please try again later."
        };
        return new ApiException(response.StatusCode, message, fields);
    }
}
