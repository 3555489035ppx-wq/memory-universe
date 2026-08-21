import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GlassButton } from './glass-button';

describe('GlassButton', () => {
  it('keeps the supplied class layers and native button semantics', () => {
    render(
      <GlassButton className="wrapper-test" buttonClassName="button-test" contentClassName="content-test">
        进入记忆
      </GlassButton>,
    );

    const button = screen.getByRole('button', { name: '进入记忆' });
    expect(button).toHaveClass('glass-button', 'glass-button--size-default', 'glass-button--medium', 'button-test');
    expect(button.parentElement).toHaveClass('glass-button-wrap', 'wrapper-test');
    expect(button.querySelector('span')).toHaveClass('glass-button-text', 'content-test');
    expect(button.parentElement?.querySelector('.glass-button-shadow')).toBeInTheDocument();
  });

  it('updates pointer variables and resets them on leave', () => {
    render(<GlassButton>跟随照片</GlassButton>);
    const button = screen.getByRole('button', { name: '跟随照片' });
    const wrapper = button.parentElement;
    expect(wrapper).not.toBeNull();
    if (!wrapper) return;

    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      top: 50,
      right: 300,
      bottom: 100,
      left: 100,
      width: 200,
      height: 50,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(button, { clientX: 200, clientY: 75 });
    expect(button.style.getPropertyValue('--mouse-x')).toBe('50%');
    expect(button.style.getPropertyValue('--mouse-y')).toBe('50%');
    fireEvent.pointerLeave(button);
    expect(button.style.getPropertyValue('--mouse-x')).toBe('30%');
    expect(button.style.getPropertyValue('--mouse-y')).toBe('0%');
  });

  it('merges user pointer handlers and does not update a disabled button', () => {
    const onMove = vi.fn();
    const onLeave = vi.fn();
    render(
      <GlassButton disabled onPointerMove={onMove} onPointerLeave={onLeave}>
        暂不可用
      </GlassButton>,
    );
    const button = screen.getByRole('button', { name: '暂不可用' });
    fireEvent.pointerMove(button, { clientX: 20, clientY: 20 });
    fireEvent.pointerLeave(button);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(button.style.getPropertyValue('--mouse-x')).toBe('');
    expect(button).toBeDisabled();
  });

  it('supports keyboard activation like a native button', () => {
    const onClick = vi.fn();
    render(
      <GlassButton onClick={onClick}>
        确认
      </GlassButton>,
    );
    const button = screen.getByRole('button', { name: '确认' });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
