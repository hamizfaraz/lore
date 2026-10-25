'use client';
import type { ConversationDTO } from '@lore/shared/dto/chat';
import { SectionHeader } from '@/components/ui/ListRow';

/** Group account creation + publishing policy editor [C1] — implemented in C1-5. */
export function GroupAccountSection({ conv }: { conv: ConversationDTO }) {
  return (
    <>
      <SectionHeader>Group account</SectionHeader>
      <p className="px-4 text-[13px] text-ink-2">
        {conv.groupAccount ? `@${conv.groupAccount.handle}` : 'Group accounts are coming soon.'}
      </p>
    </>
  );
}
