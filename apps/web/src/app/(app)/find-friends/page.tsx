import { Suspense } from 'react';
import { FindFriendsPage } from '@/features/discovery/FindFriendsPage';

export default function Page() {
  return (
    <Suspense>
      <FindFriendsPage />
    </Suspense>
  );
}
