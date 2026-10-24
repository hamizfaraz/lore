import { ChatSettingsPage } from '@/features/groups/ChatSettingsPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <ChatSettingsPage id={p.id} />;
}
