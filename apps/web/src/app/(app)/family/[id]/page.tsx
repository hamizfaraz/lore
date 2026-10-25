import { FamilyStoryPage } from '@/features/family/FamilyStoryPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <FamilyStoryPage id={p.id} />;
}
