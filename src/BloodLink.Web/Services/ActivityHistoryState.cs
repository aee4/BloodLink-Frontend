using BloodLink.Web.Models;
using BloodLink.Web.Services.Api;

namespace BloodLink.Web.Services;

public sealed class ActivityHistoryState(DashboardApiClient api)
{
    public Paged<DashboardActivityDto>? Result { get; private set; }
    public int PageNumber { get; private set; } = 1;
    public bool IsLoading { get; private set; }
    public string? ErrorMessage { get; private set; }
    public bool CanGoPrevious => !IsLoading && PageNumber > 1;
    public bool CanGoNext => !IsLoading && Result?.HasNext == true;

    public async Task LoadPageAsync(int page, CancellationToken cancellationToken = default)
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            var result = await api.Activity(Math.Max(1, page), 25, cancellationToken);
            Result = result;
            PageNumber = result.PageNumber;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (ApiException exception)
        {
            ErrorMessage = exception.Message;
        }
        catch (HttpRequestException)
        {
            ErrorMessage = "Activity could not be loaded. Check your connection and try again.";
        }
        finally
        {
            IsLoading = false;
        }
    }
}
