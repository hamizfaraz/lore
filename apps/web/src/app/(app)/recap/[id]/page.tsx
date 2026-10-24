import { RecapEditorPage } from '@/features/memories/RecapEditorPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <RecapEditorPage id={p.id} />;
}
