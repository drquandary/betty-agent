'use client';

import { useEffect } from 'react';

export function NextDevToolsOffset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const getDevToolsButton = () => {
      const portal = document.querySelector('nextjs-portal') as
        | (HTMLElement & { shadowRoot: ShadowRoot | null })
        | null;
      return portal?.shadowRoot?.getElementById('next-logo');
    };

    const hideFloatingBadge = () => {
      const portal = document.querySelector('nextjs-portal') as
        | (HTMLElement & { shadowRoot: ShadowRoot | null })
        | null;
      const indicator = portal?.shadowRoot?.getElementById('devtools-indicator');
      if (!(indicator instanceof HTMLElement)) return;

      indicator.style.display = 'none';
      indicator.style.pointerEvents = 'none';
    };

    const openDevTools = () => {
      const button = getDevToolsButton();
      if (button instanceof HTMLButtonElement) button.click();
    };

    hideFloatingBadge();
    window.addEventListener('betty-ai:open-next-devtools', openDevTools);

    const observer = new MutationObserver(hideFloatingBadge);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(hideFloatingBadge, 1000);

    return () => {
      window.removeEventListener('betty-ai:open-next-devtools', openDevTools);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
