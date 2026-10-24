import { AiStudioPage } from '@/features/persona/AiStudioPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <AiStudioPage conversationId={p.id} />;
}
