using System.ComponentModel.DataAnnotations;
using BloodLink.Web.Validation;

namespace BloodLink.Web.Models;

public sealed class StaffCreationForm
{
    [Required(ErrorMessage = "First name is required."), StringLength(100, ErrorMessage = "First name must be 100 characters or fewer.")]
    public string FirstName { get; set; } = "";

    [Required(ErrorMessage = "Last name is required."), StringLength(100, ErrorMessage = "Last name must be 100 characters or fewer.")]
    public string LastName { get; set; } = "";

    [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address."), StringLength(256, ErrorMessage = "Email must be 256 characters or fewer.")]
    public string Email { get; set; } = "";

    [StringLength(30, ErrorMessage = "Phone must be 30 characters or fewer.")]
    public string? PhoneNumber { get; set; }

    [Required(ErrorMessage = "Temporary password is required."), StringLength(256, MinimumLength = PasswordRules.MinimumLength, ErrorMessage = "Password must be between 8 and 256 characters."), PasswordPolicy]
    public string Password { get; set; } = "";
}
