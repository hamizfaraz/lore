import { ProfilePage } from '@/features/profile/ProfilePage';

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const p = await params;
  return <ProfilePage handle={p.handle} />;
}
