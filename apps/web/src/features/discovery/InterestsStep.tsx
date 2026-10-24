'use client';
/** Onboarding interests step [C2] (section 9.6 /onboarding). Stub: renders a skip button. */
export function InterestsStep({
  onDone,
  suggestedTags,
}: { onDone: () => void; suggestedTags?: { tag: string; from: 'facebook' }[] }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-ink-2">
        Pick interests to find your people
        {suggestedTags?.length ? ` (${suggestedTags.length} suggested from Facebook)` : ''}.
      </p>
      <button type="button" className="font-semibold text-action" onClick={onDone}>
        Skip for now
      </button>
    </div>
  );
}
