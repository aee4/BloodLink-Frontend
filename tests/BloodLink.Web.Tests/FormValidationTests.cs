using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text;
using BloodLink.Web.Models;
using BloodLink.Web.Services.Api;
using BloodLink.Web.Validation;
using Microsoft.AspNetCore.Components.Forms;

namespace BloodLink.Web.Tests;

public sealed class FormValidationTests
{
    [Fact]
    public void Facility_registration_required_fields_are_validated_on_the_bound_form_model()
    {
        var form = new FacilityRegistrationForm();
        var failures = Validate(form);
        var memberNames = failures.SelectMany(result => result.MemberNames).ToHashSet(StringComparer.Ordinal);

        Assert.Contains(nameof(form.Name), memberNames);
        Assert.Contains(nameof(form.FacilityType), memberNames);
        Assert.Contains(nameof(form.RegistrationNumber), memberNames);
        Assert.Contains(nameof(form.Region), memberNames);
        Assert.Contains(nameof(form.City), memberNames);
        Assert.Contains(nameof(form.Address), memberNames);
        Assert.Contains(nameof(form.ContactEmail), memberNames);
        Assert.Contains(nameof(form.ContactPhone), memberNames);
        Assert.Contains(nameof(form.AdminFirstName), memberNames);
        Assert.Contains(nameof(form.AdminLastName), memberNames);
        Assert.Contains(nameof(form.AdminEmail), memberNames);
        Assert.Contains(nameof(form.AdminPhoneNumber), memberNames);
        Assert.Contains(nameof(form.AdminPassword), memberNames);
    }

    [Fact]
    public void Facility_and_staff_forms_match_backend_lengths_email_and_optional_phone_rules()
    {
        var facility = ValidFacility();
        facility.ContactEmail = "not-an-email";
        facility.AdminEmail = "also-not-an-email";
        facility.ContactPhone = new string('1', 31);
        facility.AdminPhoneNumber = new string('2', 31);
        facility.RegistrationNumber = new string('R', 101);
        Assert.Contains(Validate(facility), result => result.MemberNames.Contains(nameof(facility.ContactEmail)));
        Assert.Contains(Validate(facility), result => result.MemberNames.Contains(nameof(facility.AdminEmail)));
        Assert.Contains(Validate(facility), result => result.MemberNames.Contains(nameof(facility.ContactPhone)));
        Assert.Contains(Validate(facility), result => result.MemberNames.Contains(nameof(facility.AdminPhoneNumber)));
        Assert.Contains(Validate(facility), result => result.MemberNames.Contains(nameof(facility.RegistrationNumber)));

        var staff = new StaffCreationForm { FirstName = "A", LastName = "B", Email = "staff@example.test", Password = "ValidPass1" };
        Assert.Empty(Validate(staff));
        staff.PhoneNumber = new string('3', 31);
        Assert.Contains(Validate(staff), result => result.MemberNames.Contains(nameof(staff.PhoneNumber)));
    }

    [Fact]
    public void Staff_creation_requires_every_required_field()
    {
        var form = new StaffCreationForm();
        var memberNames = Validate(form).SelectMany(result => result.MemberNames).ToHashSet(StringComparer.Ordinal);

        Assert.Contains(nameof(form.FirstName), memberNames);
        Assert.Contains(nameof(form.LastName), memberNames);
        Assert.Contains(nameof(form.Email), memberNames);
        Assert.Contains(nameof(form.Password), memberNames);
        Assert.DoesNotContain(nameof(form.PhoneNumber), memberNames);
    }

    [Fact]
    public void Facility_profile_edit_matches_backend_required_email_and_length_rules()
    {
        var form = new FacilityProfileForm
        {
            Address = "Local road",
            ContactEmail = "facility@example.test",
            ContactPhone = "+233201234567"
        };
        Assert.Empty(Validate(form));

        form.ContactEmail = "not-an-email";
        form.ContactPhone = new string('2', 31);
        Assert.Contains(Validate(form), result => result.MemberNames.Contains(nameof(form.ContactEmail)));
        Assert.Contains(Validate(form), result => result.MemberNames.Contains(nameof(form.ContactPhone)));
    }

    [Fact]
    public void Password_rules_match_identity_and_confirmation_is_validated_inline()
    {
        Assert.True(PasswordRules.IsValid("Valid123"));
        Assert.False(PasswordRules.IsValid("Short1"));
        Assert.False(PasswordRules.IsValid("lowercase1"));
        Assert.False(PasswordRules.IsValid("UPPERCASE1"));
        Assert.False(PasswordRules.IsValid("ValidPass"));

        var form = new ChangePasswordForm
        {
            CurrentPassword = "old password",
            NewPassword = "ValidPass1",
            ConfirmPassword = "Different1"
        };
        var mismatch = Assert.Single(Validate(form).Where(result => result.MemberNames.Contains(nameof(form.ConfirmPassword))));
        Assert.Equal("Passwords do not match.", mismatch.ErrorMessage);
    }

    [Fact]
    public void Backend_validation_problem_maps_safe_local_messages_to_matching_form_fields()
    {
        var form = ValidFacility();
        var context = new EditContext(form);
        var messages = new ValidationMessageStore(context);

        var formWithInvalidPhone = ValidFacility();
        formWithInvalidPhone.AdminPhoneNumber = new string('2', 31);
        context = new EditContext(formWithInvalidPhone);
        messages = new ValidationMessageStore(context);
        var mapped = FormValidation.ApplyServerErrors(context, messages,
            new Dictionary<string, string[]> { ["adminPhoneNumber"] = ["Check this field."] });

        Assert.True(mapped);
        Assert.Equal("Administrator phone must be 30 characters or fewer.",
            Assert.Single(context.GetValidationMessages(new FieldIdentifier(formWithInvalidPhone, nameof(formWithInvalidPhone.AdminPhoneNumber)))));
        Assert.Empty(context.GetValidationMessages(new FieldIdentifier(formWithInvalidPhone, nameof(formWithInvalidPhone.ContactPhone))));
    }

    [Fact]
    public async Task Registration_client_preserves_backend_field_errors_instead_of_replacing_them_with_generic_text()
    {
        using var http = new HttpClient(new ResponseHandler(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("{\"status\":400,\"errors\":{\"AdminPhoneNumber\":[\"A sensitive backend detail that must not be shown.\"]}}", Encoding.UTF8, "application/problem+json")
        }))
        { BaseAddress = new Uri("https://bloodlink.test/") };
        var client = new FacilityApiClient(http);

        var exception = await Assert.ThrowsAsync<ApiException>(() => client.Register(new("Example Facility", FacilityType.Hospital,
            "LIC-100", "Greater Accra", "Accra", "Example Road", "facility@example.test", "0240000000",
            "Test", "Administrator", "admin@example.test", new string('2', 31), "ValidPass1")));

        Assert.Contains("Check this field.", exception.Fields[nameof(FacilityRegistrationForm.AdminPhoneNumber)]);
        Assert.DoesNotContain("Check the entered values", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Duplicate_staff_identity_has_an_accurate_form_level_message()
    {
        using var http = new HttpClient(new ResponseHandler(new HttpResponseMessage(HttpStatusCode.Conflict)
        {
            Content = new StringContent("{\"status\":409,\"code\":\"state_conflict\"}", Encoding.UTF8, "application/problem+json")
        }))
        { BaseAddress = new Uri("https://bloodlink.test/") };
        var client = new StaffApiClient(http);

        var exception = await Assert.ThrowsAsync<ApiException>(() => client.Create(new("A", "B", "existing@example.test", null, "ValidPass1")));

        Assert.Contains("email already exists", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Duplicate_facility_registration_has_an_accurate_form_level_message()
    {
        using var http = new HttpClient(new ResponseHandler(new HttpResponseMessage(HttpStatusCode.Conflict)
        {
            Content = new StringContent("{\"status\":409,\"code\":\"state_conflict\"}", Encoding.UTF8, "application/problem+json")
        }))
        { BaseAddress = new Uri("https://bloodlink.test/") };
        var client = new FacilityApiClient(http);

        var exception = await Assert.ThrowsAsync<ApiException>(() => client.Register(new("Example Facility", FacilityType.Hospital,
            "LIC-100", "Greater Accra", "Accra", "Example Road", "facility@example.test", "+233240000000",
            "Test", "Administrator", "admin@example.test", "0240000000", "ValidPass1")));

        Assert.Contains("registration number", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("administrator email", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static List<ValidationResult> Validate(object model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), results, validateAllProperties: true);
        return results;
    }

    private static FacilityRegistrationForm ValidFacility() => new()
    {
        Name = "Example Facility",
        FacilityType = FacilityType.Hospital,
        RegistrationNumber = "LIC-100",
        Region = "Greater Accra",
        City = "Accra",
        Address = "Example Road",
        ContactEmail = "facility@example.test",
        ContactPhone = "+233240000000",
        AdminFirstName = "Test",
        AdminLastName = "Administrator",
        AdminEmail = "admin@example.test",
        AdminPhoneNumber = "0240000000",
        AdminPassword = "ValidPass1"
    };

    private sealed class ResponseHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(response);
    }
}
