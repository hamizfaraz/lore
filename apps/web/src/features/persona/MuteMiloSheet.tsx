'use client';
import type { PersonaDTO, PersonaMuteBody } from '@lore/shared/dto/persona';
import { useMutation } from '@tanstack/react-query';
import { Bell, BellOff, Clock3 } from 'lucide-react';
import { Sheet, SheetAction } from '@/components/ui/Sheet';
import { api } from '@/lib/api';
import { c2DemoHeaders } from './demo-user';

export function MuteMiloSheet(_props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  onMuted?: (persona: PersonaDTO) => void;
}) {
  const { open, onOpenChange, conversationId, onMuted } = _props;
  const mutation = useMutation({
    mutationFn: (duration: PersonaMuteBody['duration']) =>
      api.post<PersonaDTO>(
        `/v1/conversations/${conversationId}/persona/mute`,
        { duration },
        { headers: c2DemoHeaders() },
      ),
    onSuccess: (persona) => {
      onMuted?.(persona);
      onOpenChange(false);
    },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Mute AI member">
      <div className="pb-safe py-2">
        <SheetAction icon={<Clock3 size={19} />} onClick={() => mutation.mutate('one_hour')}>
          Mute for 1 hour
        </SheetAction>
        <SheetAction icon={<Clock3 size={19} />} onClick={() => mutation.mutate('eight_hours')}>
          Mute for 8 hours
        </SheetAction>
        <SheetAction icon={<BellOff size={19} />} onClick={() => mutation.mutate('until_unmuted')}>
          Mute until I turn it back on
        </SheetAction>
        <SheetAction icon={<Bell size={19} />} onClick={() => mutation.mutate('unmute')}>
          Turn AI member back on
        </SheetAction>
      </div>
    </Sheet>
  );
}
