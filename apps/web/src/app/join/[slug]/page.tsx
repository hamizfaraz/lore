import { JoinPage } from '@/features/chat/JoinPage';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params;
  return <JoinPage slug={p.slug} />;
}
