/** Auth screens: centered column, no tab bar. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[350px] flex-col justify-center px-6 pt-safe pb-safe">
      {children}
    </main>
  );
}
