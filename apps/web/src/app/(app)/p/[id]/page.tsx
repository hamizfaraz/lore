import { PostPage } from '@/features/feed/PostPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <PostPage id={p.id} />;
}
