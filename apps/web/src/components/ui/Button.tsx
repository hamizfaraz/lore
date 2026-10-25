import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/** Button: modern tactile styling with rounded-xl and subtle elevation. */
const buttonVariants = cva(
  'press-btn chrome inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-action text-white shadow-sm hover:opacity-95',
        secondary: 'bg-surface-2 text-ink border border-line/50 hover:bg-surface-2/80',
        text: 'bg-transparent text-action hover:underline',
        ghost: 'bg-transparent text-ink hover:bg-surface-2',
        danger: 'bg-rose-50 text-heart border border-rose-100 hover:bg-rose-100/70',
        ai: 'bg-ai text-white shadow-sm hover:opacity-95',
        outline: 'border border-line bg-transparent text-ink hover:bg-surface-2',
      },
      size: {
        sm: 'h-[44px] px-3 text-[14px]',
        md: 'h-[44px] px-4 text-[14px]',
        lg: 'h-[44px] px-5 text-[15px]',
        icon: 'h-[44px] w-[44px] p-0',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
export { buttonVariants };
