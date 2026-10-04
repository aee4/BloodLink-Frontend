namespace BloodLink.Web.Models;

public enum FacilityType { Hospital, BloodBank }
public enum FacilityStatus { Pending, Approved, Rejected, Suspended }
public enum StaffStatus { PendingActivation, Active, Inactive }
public enum BloodType { APositive, ANegative, BPositive, BNegative, ABPositive, ABNegative, OPositive, ONegative }
public enum UrgencyLevel { Routine, Urgent, Emergency }
public enum BloodNeedStatus { PendingReview, Searching, FulfilledInternally, FulfilledExternally, Rejected, Cancelled }
public enum BloodRequestStatus { Sent, Accepted, Rejected, Fulfilled, Cancelled }

public sealed record ApiUser(string Id, string Email, string FirstName, string LastName, Guid? FacilityId,
    IReadOnlyList<string> Roles, FacilityStatus? FacilityStatus, bool MustChangePassword);
public sealed record TokenResponse(string AccessToken, string TokenType, int ExpiresIn,
    string RefreshToken, DateTime RefreshTokenExpiresAtUtc, ApiUser User);
public sealed record FacilityDto(Guid Id, string Name, FacilityType FacilityType, string RegistrationNumber,
    string Region, string City, string Address, string ContactEmail, string ContactPhone, FacilityStatus Status,
    string? RejectionReason, DateTime CreatedAtUtc, DateTime? ApprovedAtUtc);
public sealed record StaffDto(string UserId, Guid FacilityId, string FullName, string Email, StaffStatus Status,
    DateTime CreatedAtUtc, DateTime? DeactivatedAtUtc, string? StatusReason);
public sealed record InventoryItemDto(Guid Id, Guid FacilityId, BloodType BloodType, int TotalUnits, int ReservedUnits,
    int AvailableUnits, int LowStockThreshold, DateTime? UpdatedAtUtc, byte[] RowVersion);
public sealed record InventoryTransactionDto(Guid Id, BloodType BloodType, int TransactionType, int TotalUnitsChange,
    int ReservedUnitsChange, int TotalBefore, int ReservedBefore, int TotalAfter, int ReservedAfter, string Reason,
    string? ReferenceType, Guid? ReferenceId, string ActorDisplayName, DateTime CreatedAtUtc);
public sealed record AvailabilityDto(Guid FacilityId, string FacilityName, FacilityType FacilityType, string Region,
    string City, BloodType BloodType, int AvailableUnits, DateTime UpdatedAtUtc);
public sealed record LowStockDto(BloodType BloodType, int AvailableUnits, int LowStockThreshold, DateTime UpdatedAtUtc);
public sealed record NeedDto(Guid Id, Guid FacilityId, BloodType BloodType, int UnitsNeeded, UrgencyLevel Urgency,
    BloodNeedStatus Status, DateTime CreatedAtUtc, string? Note, string? CreatorDisplayName, DateTime? UpdatedAtUtc, DateTime? NeededByUtc = null);
public sealed record NeedDetailDto(Guid Id, Guid FacilityId, string FacilityName, BloodType BloodType, int UnitsNeeded,
    UrgencyLevel Urgency, BloodNeedStatus Status, DateTime NeededByUtc, string? Note, string? DecisionReason,
    string CreatorDisplayName, DateTime CreatedAtUtc, DateTime UpdatedAtUtc, int? InventoryTotalUnits,
    int? InventoryReservedUnits, int? InventoryAvailableUnits);
public sealed record NeedTimelineDto(BloodNeedStatus? FromStatus, BloodNeedStatus ToStatus, string ActorDisplayName,
    string? Note, DateTime ChangedAtUtc);
public sealed record RequestDto(Guid Id, Guid BloodNeedId, Guid RequestingFacilityId, string RequestingFacilityName,
    Guid SourceFacilityId, string SourceFacilityName, BloodType BloodType, int UnitsRequested, int? UnitsAccepted,
    UrgencyLevel Priority, BloodRequestStatus Status, string? RequestNote, string? ResponseNote,
    DateTime CreatedAtUtc, DateTime? RespondedAtUtc, DateTime? FulfilledAtUtc);
public sealed record RequestTimelineDto(BloodRequestStatus? FromStatus, BloodRequestStatus ToStatus,
    string ActorDisplayName, string? Note, DateTime ChangedAtUtc);
public sealed record NotificationDto(Guid Id, int NotificationType, string Title, string Message, bool IsRead,
    DateTime CreatedAtUtc, string? RelatedEntityType, Guid? RelatedEntityId);
public sealed record UnreadCountDto(int Count);
public sealed record DashboardNeedDto(Guid Id, BloodType BloodType, int UnitsNeeded, UrgencyLevel Urgency,
    BloodNeedStatus Status, DateTime CreatedAtUtc);
public sealed record DashboardActivityDto(string Action, string Summary, DateTime CreatedAtUtc, string? EntityType, Guid? EntityId);
public sealed record SystemDashboardDto(int ActiveFacilities, int SuspendedFacilities, int TotalFacilities,
    int ActiveRequests, IReadOnlyList<DashboardActivityDto> RecentActivity);
public sealed record FacilityDashboardDto(int OpenNeeds, int SentRequests, int ReceivedRequests, int LowStockItems,
    long TotalInventoryUnits, long AvailableInventoryUnits, int UnreadNotifications,
    IReadOnlyList<DashboardNeedDto> PendingNeeds, IReadOnlyList<DashboardActivityDto> RecentActivity);
public sealed record StaffDashboardDto(int MyOpenNeeds, int UnreadNotifications, int PendingReviewNeeds,
    int SearchingNeeds, IReadOnlyList<DashboardNeedDto> RecentNeeds);
public sealed record Paged<T>(IReadOnlyList<T> Items, int PageNumber, int PageSize, bool HasNext);
public sealed record RegistrationRequest(string Name, FacilityType FacilityType, string RegistrationNumber,
    string Region, string City, string Address, string ContactEmail, string ContactPhone,
    string AdminFirstName, string AdminLastName, string AdminEmail, string AdminPhoneNumber, string AdminPassword);
public sealed record FacilityUpdateRequest(string Address, string ContactEmail, string ContactPhone);
public sealed record StaffCreateRequest(string FirstName, string LastName, string Email, string? PhoneNumber, string Password);
public sealed record InventoryAdjustmentRequest(BloodType BloodType, int TotalUnitsChange, string Reason, string? RowVersion);
public sealed record NeedCreateRequest(BloodType BloodType, int UnitsNeeded, UrgencyLevel Urgency, DateTime NeededByUtc, string? Note);
public sealed record NeedDecisionRequest(string? Reason);
public sealed record RequestCreateRequest(Guid BloodNeedId, Guid SourceFacilityId, int UnitsRequested, string? RequestNote);
public sealed record RequestDecisionRequest(int? UnitsAccepted, string? ResponseNote);
public sealed record FulfilRequest(string? Note);
