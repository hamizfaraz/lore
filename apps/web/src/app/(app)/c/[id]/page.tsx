import { ChatPage } from '@/features/chat/ChatPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <ChatPage id={p.id} />;
}
