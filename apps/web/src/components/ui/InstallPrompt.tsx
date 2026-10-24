'use client';
import { Share, SquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStandalone } from '@/lib/hooks';
import { Button } from './Button';
import { Sheet } from './Sheet';

/** "Install LORE" sheet with a 2-step illustration in Safari/Chrome (section 9.3). */
export function InstallPrompt() {
  const standalone = useStandalone();
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('lore.install.dismissed') === '1';
    } catch {}
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!standalone && !dismissed && isMobile) {
      const t = setTimeout(() => setOpen(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', h);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, [standalone]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem('lore.install.dismissed', '1');
    } catch {}
  };

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : close())} title="Install LORE">
      <div className="space-y-5 px-6 pb-8 pt-4">
        <p className="text-center text-ink-2">Add LORE to your home screen for the full-screen app.</p>
        {isIos || !deferred ? (
          <ol className="space-y-4">
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2">
                <Share size={22} />
              </span>
              <span>
                1. Tap <b>Share</b> in the browser toolbar
              </span>
            </li>
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2">
                <SquarePlus size={22} />
              </span>
              <span>
                2. Choose <b>Add to Home Screen</b>
              </span>
            </li>
          </ol>
        ) : (
          <Button
            block
            size="lg"
            onClick={async () => {
              await deferred.prompt();
              close();
            }}
          >
            Install
          </Button>
        )}
        <Button variant="text" block onClick={close}>
          Not now
        </Button>
      </div>
    </Sheet>
  );
}
