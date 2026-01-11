import { useEffect } from 'react';

export const useKeyboardShortcuts = (handleMenuAction: (action: string) => void) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Allow copy/paste in inputs, but block for the app level if not in input
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

            if (!isInput && (e.ctrlKey || e.metaKey)) {
                if (e.key === 'c') { e.preventDefault(); handleMenuAction('copy'); }
                if (e.key === 'x') { e.preventDefault(); handleMenuAction('cut'); }
                if (e.key === 'v') { e.preventDefault(); handleMenuAction('paste'); }
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleMenuAction('undo'); }
                if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleMenuAction('redo'); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleMenuAction]);
};
