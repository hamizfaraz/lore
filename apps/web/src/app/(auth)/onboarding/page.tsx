import { Suspense } from 'react';
import { OnboardingPage } from '@/features/auth/OnboardingPage';

export default function Page() {
  return (
    <Suspense>
      <OnboardingPage />
    </Suspense>
  );
}
