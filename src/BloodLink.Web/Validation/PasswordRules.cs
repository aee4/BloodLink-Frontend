using System.ComponentModel.DataAnnotations;

namespace BloodLink.Web.Validation;

public static class PasswordRules
{
    public const int MinimumLength = 8;

    public static bool HasUppercase(string? value) => value?.Any(char.IsUpper) == true;
    public static bool HasLowercase(string? value) => value?.Any(char.IsLower) == true;
    public static bool HasDigit(string? value) => value?.Any(char.IsDigit) == true;
    public static bool IsValid(string? value) => value?.Length >= MinimumLength
        && HasUppercase(value) && HasLowercase(value) && HasDigit(value);
}

[AttributeUsage(AttributeTargets.Property)]
public sealed class PasswordPolicyAttribute : ValidationAttribute
{
    public PasswordPolicyAttribute() => ErrorMessage = "Password must include at least one uppercase letter, one lowercase letter, and one number.";

    public override bool IsValid(object? value) => value is null or string { Length: 0 }
        || value is string password && PasswordRules.IsValid(password);
}
