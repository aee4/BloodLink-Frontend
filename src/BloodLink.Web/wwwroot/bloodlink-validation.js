window.bloodLinkValidation = {
  async focusFirstInvalid(formId) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const form = document.getElementById(formId);
    const firstInvalid = form?.querySelector('[aria-invalid="true"]');
    if (!firstInvalid) return;
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid.focus({ preventScroll: true });
  }
};
