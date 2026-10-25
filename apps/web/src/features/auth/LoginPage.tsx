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
  password: z.string().min(1, 'Enter your password'),
});

/** Instagram-style login: wordmark, fields, blue Log in, "Continue with Facebook" (section 9.6). */
export function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = form.handleSubmit(async (v) => {
    const res = await authClient.signIn.email({ email: v.email.trim().toLowerCase(), password: v.password });
    if (res.error) {
      form.setError('password', { message: res.error.message ?? 'Sorry, your password was incorrect.' });
      return;
    }
    await qc.invalidateQueries();
    router.replace('/');
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="wordmark mb-4 text-[44px]">lore</h1>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-2" noValidate>
        <Field
          placeholder="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...form.register('email')}
          error={errors.email?.message}
        />
        <Field
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          error={errors.password?.message}
        />
        <Button type="submit" block size="lg" className="mt-2" loading={isSubmitting}>
          Log in
        </Button>
      </form>
      <div className="flex w-full items-center gap-4 text-[13px] font-semibold text-ink-2">
        <span className="h-px flex-1 bg-line" />
        OR
        <span className="h-px flex-1 bg-line" />
      </div>
      <FacebookButton />
      <p className="mt-6 text-[14px]">
        Don't have an account?{' '}
        <Link href="/signup" className="font-semibold text-action">
          Sign up
        </Link>
      </p>
    </div>
  );
}
