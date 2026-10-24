import { ChatDetailsPage } from '@/features/chat/ChatDetailsPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <ChatDetailsPage id={p.id} />;
}
