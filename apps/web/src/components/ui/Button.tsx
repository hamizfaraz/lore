import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/** Button: blue primary / gray secondary / text (section 9.5). Pressed = scale 0.97. */
const buttonVariants = cva(
  'press-btn chrome inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-semibold disabled:opacity-40 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-action text-white',
        secondary: 'bg-surface-2 text-ink',
        text: 'bg-transparent text-action',
        ghost: 'bg-transparent text-ink',
        danger: 'bg-transparent text-heart',
        ai: 'bg-ai text-white',
        outline: 'border border-line bg-transparent text-ink',
      },
      size: {
        sm: 'h-8 px-3 text-[14px]',
        md: 'h-9 px-4 text-[14px]',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-10 w-10 p-0',
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
