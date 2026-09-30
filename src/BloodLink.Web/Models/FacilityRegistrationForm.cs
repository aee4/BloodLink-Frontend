using System.ComponentModel.DataAnnotations;
using BloodLink.Web.Validation;

namespace BloodLink.Web.Models;

public sealed class FacilityRegistrationForm
{
    [Required(ErrorMessage = "Facility name is required."), StringLength(200, ErrorMessage = "Facility name must be 200 characters or fewer.")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "Select a facility type."), EnumDataType(typeof(FacilityType), ErrorMessage = "Select a valid facility type.")]
    public FacilityType? FacilityType { get; set; }

    [Required(ErrorMessage = "Registration number is required."), StringLength(100, ErrorMessage = "Registration number must be 100 characters or fewer.")]
    public string RegistrationNumber { get; set; } = "";

    [Required(ErrorMessage = "Region is required."), StringLength(100, ErrorMessage = "Region must be 100 characters or fewer.")]
    public string Region { get; set; } = "";

    [Required(ErrorMessage = "City is required."), StringLength(100, ErrorMessage = "City must be 100 characters or fewer.")]
    public string City { get; set; } = "";

    [Required(ErrorMessage = "Address is required."), StringLength(500, ErrorMessage = "Address must be 500 characters or fewer.")]
    public string Address { get; set; } = "";

    [Required(ErrorMessage = "Facility email is required."), EmailAddress(ErrorMessage = "Enter a valid email address."), StringLength(256, ErrorMessage = "Facility email must be 256 characters or fewer.")]
    public string ContactEmail { get; set; } = "";

    [Required(ErrorMessage = "Facility phone is required."), StringLength(30, ErrorMessage = "Facility phone must be 30 characters or fewer.")]
    public string ContactPhone { get; set; } = "";

    [Required(ErrorMessage = "Administrator first name is required."), StringLength(100, ErrorMessage = "First name must be 100 characters or fewer.")]
    public string AdminFirstName { get; set; } = "";

    [Required(ErrorMessage = "Administrator last name is required."), StringLength(100, ErrorMessage = "Last name must be 100 characters or fewer.")]
    public string AdminLastName { get; set; } = "";

    [Required(ErrorMessage = "Administrator email is required."), EmailAddress(ErrorMessage = "Enter a valid email address."), StringLength(256, ErrorMessage = "Administrator email must be 256 characters or fewer.")]
    public string AdminEmail { get; set; } = "";

    [Required(ErrorMessage = "Administrator phone is required."), StringLength(30, ErrorMessage = "Administrator phone must be 30 characters or fewer.")]
    public string AdminPhoneNumber { get; set; } = "";

    [Required(ErrorMessage = "Administrator password is required."), StringLength(256, MinimumLength = PasswordRules.MinimumLength, ErrorMessage = "Password must be between 8 and 256 characters."), PasswordPolicy]
    public string AdminPassword { get; set; } = "";
}
