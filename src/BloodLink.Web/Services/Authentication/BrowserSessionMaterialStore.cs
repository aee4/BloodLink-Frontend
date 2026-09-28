using Microsoft.JSInterop;

namespace BloodLink.Web.Services.Authentication;

public sealed class BrowserSessionMaterialStore(IJSRuntime javascript) : ISessionMaterialStore, IAsyncDisposable
{
    private const string ModulePath = "./session-storage.js";
    private const string StorageKey = "bloodlink.refresh";
    private Task<IJSObjectReference>? moduleTask;

    public async Task<string?> ReadRefreshTokenAsync(CancellationToken cancellationToken = default) =>
        await (await GetModuleAsync()).InvokeAsync<string?>("read", cancellationToken, StorageKey);

    public async Task WriteRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default) =>
        await (await GetModuleAsync()).InvokeVoidAsync("write", cancellationToken, StorageKey, refreshToken);

    public async Task ClearAsync(CancellationToken cancellationToken = default) =>
        await (await GetModuleAsync()).InvokeVoidAsync("clear", cancellationToken, StorageKey);

    public async ValueTask DisposeAsync()
    {
        if (moduleTask is { IsCompletedSuccessfully: true })
            await moduleTask.Result.DisposeAsync();
    }

    private Task<IJSObjectReference> GetModuleAsync() =>
        moduleTask ??= javascript.InvokeAsync<IJSObjectReference>("import", ModulePath).AsTask();
}
