using System.ComponentModel.DataAnnotations;

namespace BloodLink.Web.Models;

public sealed class FacilityProfileForm
{
    [Required(ErrorMessage = "Facility address is required.")]
    [StringLength(500, ErrorMessage = "Facility address must be 500 characters or fewer.")]
    public string Address { get; set; } = "";

    [Required(ErrorMessage = "Facility contact email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid facility contact email.")]
    [StringLength(256, ErrorMessage = "Facility contact email must be 256 characters or fewer.")]
    public string ContactEmail { get; set; } = "";

    [Required(ErrorMessage = "Facility contact phone is required.")]
    [StringLength(30, ErrorMessage = "Facility contact phone must be 30 characters or fewer.")]
    public string ContactPhone { get; set; } = "";
}
