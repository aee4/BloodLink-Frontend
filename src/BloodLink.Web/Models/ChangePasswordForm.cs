using System.ComponentModel.DataAnnotations;
using BloodLink.Web.Validation;

namespace BloodLink.Web.Models;

public sealed class ChangePasswordForm
{
    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = "";

    [Required(ErrorMessage = "New password is required."), MinLength(PasswordRules.MinimumLength, ErrorMessage = "New password must be at least 8 characters."), PasswordPolicy]
    public string NewPassword { get; set; } = "";

    [Required(ErrorMessage = "Confirm your new password."), Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = "";
}
