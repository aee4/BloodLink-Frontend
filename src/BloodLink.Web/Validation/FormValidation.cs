using System.Reflection;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Components.Forms;

namespace BloodLink.Web.Validation;

public static class FormValidation
{
    public static bool ApplyServerErrors(EditContext editContext, ValidationMessageStore messages,
        IReadOnlyDictionary<string, string[]> errors)
    {
        var applied = false;
        foreach (var (key, values) in errors)
        {
            var member = ResolveMember(editContext.Model.GetType(), key);
            if (member is null || values.Length == 0) continue;
            var identifier = new FieldIdentifier(editContext.Model, member);
            var property = editContext.Model.GetType().GetProperty(member);
            var localErrors = property is null ? [] : ValidateProperty(property, editContext.Model);
            foreach (var value in localErrors.Length > 0 ? localErrors : ["The server rejected this field. Check its value and format."])
                messages.Add(identifier, value);
            applied = true;
        }

        if (applied) editContext.NotifyValidationStateChanged();
        return applied;
    }

    public static void ClearServerError(EditContext editContext, ValidationMessageStore messages, FieldChangedEventArgs args)
    {
        messages.Clear(args.FieldIdentifier);
        editContext.NotifyValidationStateChanged();
    }

    private static string? ResolveMember(Type modelType, string key)
    {
        var normalized = key.Split('.', StringSplitOptions.RemoveEmptyEntries).LastOrDefault()?.Trim();
        return modelType.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .FirstOrDefault(property => string.Equals(property.Name, normalized, StringComparison.OrdinalIgnoreCase))?.Name;
    }

    private static string[] ValidateProperty(PropertyInfo property, object model)
    {
        var results = new List<ValidationResult>();
        var context = new ValidationContext(model) { MemberName = property.Name };
        Validator.TryValidateProperty(property.GetValue(model), context, results);
        return results.Select(result => result.ErrorMessage).Where(message => !string.IsNullOrWhiteSpace(message)).Cast<string>().ToArray();
    }
}
