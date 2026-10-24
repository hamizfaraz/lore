import { PlansPage } from '@/features/plans/PlansPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <PlansPage conversationId={p.id} />;
}
