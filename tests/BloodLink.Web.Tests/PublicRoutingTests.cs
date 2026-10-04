using System.Text.RegularExpressions;

namespace BloodLink.Web.Tests;

public sealed class PublicRoutingTests
{
    private static readonly string Root = FindRoot();
    private static string Read(string file) => File.ReadAllText(Path.Combine(Root, "src/BloodLink.Web", file));

    [Theory]
    [InlineData("Home", "/")]
    [InlineData("About", "/about")]
    [InlineData("How it works", "/#how-it-works")]
    [InlineData("Features", "/#features")]
    [InlineData("Register facility", "/facility/register")]
    public void Desktop_and_mobile_use_the_same_real_links(string label, string destination)
    {
        var links = Regex.Matches(Read("Layout/PublicHeader.razor"), $"<a[^>]*href=\"([^\"]+)\"[^>]*>{Regex.Escape(label)}</a>");
        Assert.Equal(2, links.Count);
        Assert.All(links.Cast<Match>(), link => Assert.Equal(destination, link.Groups[1].Value));
    }

    [Theory]
    [InlineData("Layout/PublicHeader.razor")]
    [InlineData("Layout/PublicFooter.razor")]
    [InlineData("Pages/Home.razor")]
    [InlineData("Pages/About.razor")]
    [InlineData("Pages/Login.razor")]
    [InlineData("Pages/FacilityRegister.razor")]
    public void Public_links_only_use_canonical_routes_and_intentional_fragments(string file)
    {
        string[] destinations = ["/", "/about", "/account/login", "/facility/register", "/#features", "/#how-it-works", "#main-content"];
        foreach (Match link in Regex.Matches(Read(file), "href=\"([^\"]+)\""))
            Assert.Contains(link.Groups[1].Value, destinations);
        Assert.DoesNotMatch("href=\"[^\"]*#[^\"]*\"[^>]*>About", Read(file));
    }

    [Fact]
    public void Alias_is_a_route_without_redirects_and_is_active_with_canonical_registration()
    {
        var registration = Read("Pages/FacilityRegister.razor");
        Assert.Contains("@page \"/facility/register\"", registration);
        Assert.Contains("@page \"/facilities/register\"", registration);
        Assert.DoesNotContain("NavigateTo", registration);
        Assert.Contains("AbsolutePath is \"/facility/register\" or \"/facilities/register\"", Read("Layout/PublicHeader.razor"));
    }

    [Fact]
    public void Home_fragment_is_resolved_after_render_without_creating_history_entries()
    {
        Assert.Contains("id=\"how-it-works\"", Read("Pages/Home.razor"));
        Assert.Contains("id=\"how\"", Read("Pages/Home.razor"));
        Assert.Contains("OnAfterRenderAsync", Read("Pages/Home.razor"));
        var script = Read("wwwroot/public-navigation.js");
        Assert.Contains("scrollIntoView", script);
        Assert.DoesNotContain("pushState", script);
        Assert.DoesNotContain("replaceState", script);
        Assert.Contains("scroll-margin-top: 5.5rem", Read("wwwroot/app.css"));
        Assert.Contains("prefers-reduced-motion: reduce", Read("wwwroot/app.css"));
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "BloodLink.Frontend.sln"))) return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException();
    }
}
