// Match the existing collapsed sidebar breakpoint while keeping one account section.
export function observe(dotnet) {
    const media = window.matchMedia('(max-width: 991.98px)');
    let disposed = false;
    const changed = async event => {
        if (disposed) return;
        const signOutFocused = document.activeElement?.matches('.bl-nav-signout');
        try {
            await dotnet.invokeMethodAsync('SetMobileLayout', event.matches);
        } catch (error) {
            if (!disposed) throw error;
        }
        if (!disposed && signOutFocused) document.querySelector('.bl-nav-signout')?.focus();
    };
    media.addEventListener('change', changed);
    return {
        matches: () => media.matches,
        dispose: () => {
            disposed = true;
            media.removeEventListener('change', changed);
        }
    };
}
