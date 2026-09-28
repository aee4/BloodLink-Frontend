(() => {
    const selector = ".bl-modal-backdrop .bl-modal[role='dialog'][aria-modal='true']";
    let activeModal = null;
    let returnFocus = null;

    function focusableElements(modal) {
        return [...modal.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => element.getClientRects().length > 0);
    }

    function syncModal() {
        const next = [...document.querySelectorAll(selector)]
            .find(modal => modal.getClientRects().length > 0);

        if (activeModal && (!activeModal.isConnected || activeModal !== next)) {
            const previous = returnFocus;
            activeModal = null;
            returnFocus = null;
            if (!next && previous?.isConnected) previous.focus();
        }

        if (next && next !== activeModal) {
            returnFocus = document.activeElement;
            activeModal = next;
            const focusables = focusableElements(next);
            (focusables[0] ?? next).focus();
        }
    }

    document.addEventListener('keydown', event => {
        const modal = activeModal;
        if (!modal?.isConnected) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            const cancel = [...modal.querySelectorAll('button')]
                .find(button => /^(back|cancel)$/i.test(button.textContent.trim()));
            cancel?.click();
            return;
        }

        if (event.key !== 'Tab') return;
        const focusables = focusableElements(modal);
        if (!focusables.length) {
            event.preventDefault();
            modal.focus();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
        }
    }, true);

    new MutationObserver(syncModal).observe(document.body, { childList: true, subtree: true });
    syncModal();
})();
