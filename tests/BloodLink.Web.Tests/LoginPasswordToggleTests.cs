using System.Reflection;
using BloodLink.Web.Pages;

namespace BloodLink.Web.Tests;

public sealed class LoginPasswordToggleTests
{
    private static PropertyInfo Property(string name) => typeof(Login).GetProperty(name, BindingFlags.NonPublic | BindingFlags.Instance)!;

    [Fact]
    public void Password_visibility_defaults_to_hidden()
    {
        Assert.False((bool)Property("PasswordVisible").GetValue(new Login())!);
    }

    [Fact]
    public void Visibility_state_does_not_replace_the_password()
    {
        var login = new Login();
        Property("Password").SetValue(login, "Local-only password 123!");
        foreach (var visible in new[] { true, false })
        {
            Property("PasswordVisible").SetValue(login, visible);
            Assert.Equal(visible, Property("PasswordVisible").GetValue(login));
            Assert.Equal("Local-only password 123!", Property("Password").GetValue(login));
        }
    }

    [Fact]
    public void Toggle_preserves_native_input_and_accessible_non_submit_button_contract()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "BloodLink.Frontend.sln"))) root = root.Parent;
        Assert.NotNull(root);
        var source = File.ReadAllText(Path.Combine(root!.FullName, "src/BloodLink.Web/Pages/Login.razor"));
        Assert.Contains("type=\"@(PasswordVisible ? \"text\" : \"password\")\"", source);
        Assert.Contains("autocomplete=\"current-password\"", source);
        Assert.Contains("@bind=\"Password\"", source);
        Assert.Contains("type=\"button\" aria-controls=\"login-password\"", source);
        Assert.Contains("aria-label=\"@(PasswordVisible ? \"Hide password\" : \"Show password\")\"", source);
        Assert.Contains("@onclick=\"() => PasswordVisible = !PasswordVisible\"", source);
        Assert.Contains("for=\"login-password\"", source);
    }

    [Theory]
    [InlineData(typeof(Login), "/account/login")]
    [InlineData(typeof(FacilityRegister), "/facility/register")]
    [InlineData(typeof(FacilityRegister), "/facilities/register")]
    public void Access_routes_remain_registered(Type page, string route)
    {
        Assert.Contains(page.GetCustomAttributes<Microsoft.AspNetCore.Components.RouteAttribute>(), a => a.Template == route);
    }
}
