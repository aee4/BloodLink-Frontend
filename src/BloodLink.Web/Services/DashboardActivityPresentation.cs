using System.Globalization;
using System.Text.Json;

namespace BloodLink.Web.Services;

public static class DashboardActivityPresentation
{
    private const int MaximumItems = 5;
    private const string TimestampProperty = "createdAtUtc";

    public static string DisplayAction(JsonElement item)
    {
        var action = item.ValueKind == JsonValueKind.Object && item.TryGetProperty("action", out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;
        return DisplayAction(action);
    }

    public static string DisplayAction(string action) => action switch
    {
        "AccountLogin" => "Account login",
        "AccountPasswordChanged" => "Password changed",
        "FacilityRegistered" => "Facility registered",
        "FacilityUpdated" => "Facility details updated",
        "FacilitySuspended" => "Facility suspended",
        "FacilityRestored" => "Facility restored",
        "StaffCreated" => "Staff member created",
        "StaffActive" => "Staff member activated",
        "StaffInactive" => "Staff member deactivated",
        "StaffPendingActivation" => "Staff member awaiting activation",
        "BloodNeedSubmitted" => "Blood need submitted",
        "BloodNeedStatusChanged" => "Blood need status changed",
        "BloodRequestCreated" => "Blood request created",
        "BloodRequestAccepted" => "Blood request accepted",
        "BloodRequestRejected" => "Blood request rejected",
        "BloodRequestCancelled" => "Blood request cancelled",
        "BloodRequestFulfilled" => "Blood request fulfilled",
        "InventoryAdjusted" => "Inventory adjusted",
        "InventoryAdjustment" => "Inventory adjusted",
        _ => action
    };

    public static string FormatTimestamp(DateTime timestamp)
    {
        var utc = DateTime.SpecifyKind(timestamp, DateTimeKind.Utc);
        return utc.ToLocalTime().ToString("dd MMM yyyy, h:mm tt", CultureInfo.InvariantCulture);
    }

    public static string MachineTimestamp(DateTime timestamp) =>
        DateTime.SpecifyKind(timestamp, DateTimeKind.Utc).ToString("O", CultureInfo.InvariantCulture);

    public static IReadOnlyList<JsonElement> LatestFive(IEnumerable<JsonElement> items) =>
        items.OrderByDescending(ReadTimestamp)
            .Take(MaximumItems)
            .ToArray();

    public static string FormatTimestamp(JsonElement item, TimeZoneInfo? displayTimezone = null)
    {
        var timestamp = ReadTimestamp(item);
        return timestamp is null
            ? "Time unavailable"
            : TimeZoneInfo.ConvertTime(timestamp.Value, displayTimezone ?? TimeZoneInfo.Local)
                .ToString("dd MMM yyyy, h:mm tt", CultureInfo.InvariantCulture);
    }

    public static string MachineTimestamp(JsonElement item) =>
        ReadTimestamp(item)?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty;

    private static DateTimeOffset? ReadTimestamp(JsonElement item)
    {
        if (item.ValueKind != JsonValueKind.Object ||
            !item.TryGetProperty(TimestampProperty, out var value) ||
            value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return DateTimeOffset.TryParse(
            value.GetString(),
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var timestamp)
            ? timestamp
            : null;
    }
}
