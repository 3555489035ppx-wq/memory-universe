import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(' ');
}

const glassButtonVariants = cva('glass-button', {
  variants: {
    size: {
      default: 'glass-button--size-default',
      sm: 'glass-button--size-sm',
      lg: 'glass-button--size-lg',
      icon: 'glass-button--size-icon',
    },
    strength: {
      strong: 'glass-button--strong',
      medium: 'glass-button--medium',
      subtle: 'glass-button--subtle',
    },
  },
  defaultVariants: { size: 'default', strength: 'medium' },
});

const glassButtonTextVariants = cva('glass-button-text', {
  variants: {
    size: {
      default: 'glass-button-text--default',
      sm: 'glass-button-text--sm',
      lg: 'glass-button-text--lg',
      icon: 'glass-button-text--icon',
    },
  },
  defaultVariants: { size: 'default' },
});

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  /** Additional classes applied to the content span. */
  contentClassName?: string;
  /** Additional classes applied to the native button. */
  buttonClassName?: string;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      buttonClassName,
      contentClassName,
      children,
      size,
      strength,
      disabled,
      onPointerMove,
      onPointerLeave,
      ...props
    },
    ref,
  ) => {
    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
      onPointerMove?.(event);
      if (disabled || event.defaultPrevented) return;

      const wrapper = event.currentTarget.parentElement;
      const rect = (wrapper ?? event.currentTarget).getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
      event.currentTarget.style.setProperty('--mouse-x', `${String(Math.max(0, Math.min(100, x)))}%`);
      event.currentTarget.style.setProperty('--mouse-y', `${String(Math.max(0, Math.min(100, y)))}%`);
    };

    const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>): void => {
      onPointerLeave?.(event);
      if (disabled) return;
      event.currentTarget.style.setProperty('--mouse-x', '30%');
      event.currentTarget.style.setProperty('--mouse-y', '0%');
    };

    return (
      <div className={cn('glass-button-wrap', className)}>
        <button
          ref={ref}
          className={cn(glassButtonVariants({ size, strength }), buttonClassName)}
          disabled={disabled}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>
            {children}
          </span>
        </button>
        <span className="glass-button-shadow" aria-hidden="true" />
      </div>
    );
  },
);

GlassButton.displayName = 'GlassButton';

// The variant factory is intentionally exported for consumers that need to
// compose the same glass treatment outside the component itself.
// eslint-disable-next-line react-refresh/only-export-components
export { glassButtonVariants };
