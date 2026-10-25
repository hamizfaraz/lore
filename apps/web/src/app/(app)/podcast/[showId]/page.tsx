import { PodcastPage } from '@/features/podcast/PodcastPage';

export default async function Page({ params }: { params: Promise<{ showId: string }> }) {
  const p = await params;
  return <PodcastPage showId={p.showId} />;
}
