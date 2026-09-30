namespace BloodLink.Web.Services;

/// <summary>Frontend guard for the known partial-acceptance fulfillment inconsistency.</summary>
public static class RequestAcceptancePolicy
{
    public static bool CanAcceptFullRequest(int unitsRequested, int? availableUnits) =>
        unitsRequested > 0 && availableUnits is int available && available >= unitsRequested;
}
