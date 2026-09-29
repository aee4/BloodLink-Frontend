namespace BloodLink.Web.Services.Authentication;

public sealed class ApplicationInitializationGate
{
    private readonly object sync = new();
    private Task? initialization;

    public bool IsInitialized { get; private set; }

    public Task InitializeAsync(Func<Task> restoreSession)
    {
        ArgumentNullException.ThrowIfNull(restoreSession);

        lock (sync)
        {
            return initialization ??= InitializeCoreAsync(restoreSession);
        }
    }

    private async Task InitializeCoreAsync(Func<Task> restoreSession)
    {
        try
        {
            await restoreSession();
        }
        finally
        {
            IsInitialized = true;
        }
    }
}
