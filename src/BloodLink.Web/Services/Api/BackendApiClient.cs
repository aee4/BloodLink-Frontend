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
            if (!response.IsSuccessStatusCode) throw await CreateException(response, request.RequestUri?.OriginalString, cancellationToken);
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

    private static async Task<ApiException> CreateException(HttpResponseMessage response, string? requestPath, CancellationToken cancellationToken)
    {
        if (response.StatusCode == HttpStatusCode.Unauthorized
            && response.Headers.Contains("X-BloodLink-Suppress-Session-Expired"))
            return new ApiException(response.StatusCode, "");

        IReadOnlyDictionary<string, string[]> fields = new Dictionary<string, string[]>();
        string? code = null;
        if (response.Content.Headers.ContentLength != 0)
        {
            try
            {
                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                var root = document.RootElement;
                if (TryGetProperty(root, "errors", out var errors) && errors.ValueKind == JsonValueKind.Object)
                    fields = errors.EnumerateObject().Where(property => HasMessages(property.Value))
                        .ToDictionary(property => property.Name, _ => new[] { "Check this field." });
                if (TryGetProperty(root, "code", out var codeElement) && codeElement.ValueKind == JsonValueKind.String)
                    code = codeElement.GetString();
            }
            catch (JsonException) { }
        }

        var message = response.StatusCode switch
        {
            HttpStatusCode.BadRequest when fields.Count > 0 => "Some details need correction. Review the messages beside the marked fields.",
            HttpStatusCode.BadRequest when code == "validation_error" => "One or more details do not meet the required format or password policy. Review the form and try again.",
            HttpStatusCode.BadRequest => "The submitted details could not be accepted. Review the form and try again.",
            HttpStatusCode.Unauthorized when IsLoginRequest(requestPath) => "Unable to sign in with these credentials.",
            HttpStatusCode.Unauthorized => "Your session has expired. Sign in again.",
            HttpStatusCode.Forbidden => "Your account does not have permission to do that.",
            HttpStatusCode.NotFound => "This record is unavailable or no longer exists.",
            HttpStatusCode.Conflict when IsFacilityRegistration(requestPath) => "The facility name or registration number may already be in use, or the administrator email may belong to an existing account. Check those details.",
            HttpStatusCode.Conflict when IsStaffCreation(requestPath) => "An account with this email already exists. Use a different email address.",
            HttpStatusCode.Conflict => "This request conflicts with the current record or state. Check its current status and try again.",
            HttpStatusCode.TooManyRequests => "Too many requests. Wait a moment and try again.",
            _ => "BloodLink could not complete that request. Please try again later."
        };
        return new ApiException(response.StatusCode, message, fields);
    }

    private static bool HasMessages(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Array => value.EnumerateArray().Any(item => item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString())),
        JsonValueKind.String => !string.IsNullOrWhiteSpace(value.GetString()),
        _ => false
    };

    private static bool TryGetProperty(JsonElement value, string name, out JsonElement property)
    {
        foreach (var item in value.EnumerateObject())
        {
            if (string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                property = item.Value;
                return true;
            }
        }

        property = default;
        return false;
    }

    private static bool IsFacilityRegistration(string? requestPath) => IsPath(requestPath, "api/v1/facilities/register");
    private static bool IsStaffCreation(string? requestPath) => IsPath(requestPath, "api/v1/staff");

    private static bool IsPath(string? requestPath, string expectedPath)
    {
        var path = Uri.TryCreate(requestPath, UriKind.Absolute, out var absoluteUri)
            ? absoluteUri.AbsolutePath
            : requestPath;
        return string.Equals(path?.TrimStart('/'), expectedPath, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsLoginRequest(string? requestPath)
    {
        var path = Uri.TryCreate(requestPath, UriKind.Absolute, out var absoluteUri)
            ? absoluteUri.AbsolutePath
            : requestPath;
        return string.Equals(path?.TrimStart('/'), "api/v1/auth/login", StringComparison.OrdinalIgnoreCase);
    }
}
