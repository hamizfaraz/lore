'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/lib/store';

function FbGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07"
      />
    </svg>
  );
}

/**
 * "Continue with Facebook" — LORE shows its own consent screen before the Facebook dialog (section 8.6).
 * Scopes: public_profile, email, user_likes, user_friends. Declining user_likes still logs in.
 */
export function FacebookButton({
  label = 'Continue with Facebook',
  variant = 'text',
}: { label?: string; variant?: 'text' | 'primary' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const res = await authClient.signIn.social({
      provider: 'facebook',
      callbackURL: '/onboarding?fb=1',
      newUserCallbackURL: '/onboarding?fb=1',
    });
    if (res?.error) {
      setBusy(false);
      toast(res.error.message ?? 'Facebook login is not available right now', 'error');
    }
  };
  return (
    <>
      <Button
        variant={variant}
        block
        onClick={() => setOpen(true)}
        className={variant === 'text' ? 'text-[#0095f6]' : ''}
      >
        <FbGlyph />
        {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Before you continue">
        <div className="space-y-4 px-6 pb-8 pt-4 text-[15px]">
          <p>
            We'll use your Page likes to suggest interests (you can edit them) and show which friends are
            already here. We never post to Facebook.
          </p>
          <ul className="space-y-1.5 text-[14px] text-ink-2">
            <li>• Name and profile picture</li>
            <li>• Email address</li>
            <li>• Pages you like (optional)</li>
            <li>• Friends who also use LORE (optional)</li>
          </ul>
          <Button block size="lg" loading={busy} onClick={go}>
            Continue
          </Button>
          <Button variant="text" block onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </>
  );
}
