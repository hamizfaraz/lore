import { Suspense } from 'react';
import { SettingsPage } from '@/features/profile/SettingsPage';

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
