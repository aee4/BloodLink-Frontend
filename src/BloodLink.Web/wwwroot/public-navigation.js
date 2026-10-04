// Blazor renders Home after the browser's initial fragment lookup on direct visits.
// Keep real anchor navigation and its history; only resolve the target after render.
window.bloodLinkPublicNavigation = {
    scrollToFragment() {
        const id = window.location.hash.slice(1);
        if (!['how-it-works', 'how', 'features', 'main-content'].includes(id)) return;
        requestAnimationFrame(() => {
            const target = document.getElementById(id === 'how' ? 'how-it-works' : id);
            target?.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
    }
};

// Re-selecting the current section should scroll again without a duplicate entry.
document.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const destination = new URL(link.href);
    if (destination.href !== window.location.href || destination.pathname !== '/' ||
        !['#how-it-works', '#how', '#features'].includes(destination.hash)) return;
    event.preventDefault();
    window.bloodLinkPublicNavigation.scrollToFragment();
}, true);
