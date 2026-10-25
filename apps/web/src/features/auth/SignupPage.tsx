'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { authClient } from '@/lib/auth-client';
import { FacebookButton } from './FacebookButton';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  name: z.string().min(1, 'Enter your name').max(60),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export function SignupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = form.handleSubmit(async (v) => {
    const res = await authClient.signUp.email({
      email: v.email.trim().toLowerCase(),
      password: v.password,
      name: v.name.trim(),
    });
    if (res.error) {
      form.setError('email', { message: res.error.message ?? 'Could not create your account' });
      return;
    }
    await qc.invalidateQueries();
    router.replace('/onboarding');
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <div className="flex flex-col items-center gap-5">
      <h1 className="wordmark text-[44px]">lore</h1>
      <p className="text-center text-[16px] font-semibold text-ink-2">
        Sign up to make more life with your people.
      </p>
      <FacebookButton variant="primary" label="Sign up with Facebook" />
      <div className="flex w-full items-center gap-4 text-[13px] font-semibold text-ink-2">
        <span className="h-px flex-1 bg-line" />
        OR
        <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-2" noValidate>
        <Field
          placeholder="Email"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          error={errors.email?.message}
        />
        <Field
          placeholder="Full name"
          autoComplete="name"
          {...form.register('name')}
          error={errors.name?.message}
        />
        <Field
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
          error={errors.password?.message}
        />
        <Button type="submit" block size="lg" className="mt-2" loading={isSubmitting}>
          Sign up
        </Button>
      </form>
      <p className="mt-4 text-[14px]">
        Have an account?{' '}
        <Link href="/login" className="font-semibold text-action">
          Log in
        </Link>
      </p>
    </div>
  );
}
