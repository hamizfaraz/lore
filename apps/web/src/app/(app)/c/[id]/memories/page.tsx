import { MemoriesPage } from '@/features/memories/MemoriesPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <MemoriesPage conversationId={p.id} />;
}
