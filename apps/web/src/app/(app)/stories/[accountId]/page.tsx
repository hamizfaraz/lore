import { StoryViewerPage } from '@/features/stories/StoryViewerPage';

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const p = await params;
  return <StoryViewerPage accountId={p.accountId} />;
}
