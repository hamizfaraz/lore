import { GamePage } from '@/features/games/GamePage';

export default async function Page({ params }: { params: Promise<{ id: string; gameId: string }> }) {
  const p = await params;
  return <GamePage conversationId={p.id} gameId={p.gameId} />;
}
