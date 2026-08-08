import { describe, expect, it } from 'vitest';

import { CameraPoseStack, CameraStateMachine, type CameraPose } from './CameraStateMachine';

function pose(id: string | null): CameraPose {
  return {
    position: [0, 1, 12],
    target: [0, 0, 0],
    fov: 52,
    near: 0.1,
    far: 120,
    view: 'time',
    focusedMemoryId: id,
  };
}

describe('CameraStateMachine', () => {
  it('rejects completion from a cancelled transition', () => {
    const machine = new CameraStateMachine();
    const first = machine.begin('diving');
    const second = machine.begin('echoing');

    expect(machine.complete(first.token, 'inside-memory')).toBe(false);
    expect(machine.complete(second.token, 'inside-memory')).toBe(true);
    expect(machine.state).toBe('inside-memory');
  });

  it('invalidates active work when cancelled', () => {
    const machine = new CameraStateMachine();
    const transition = machine.begin('focusing');
    machine.cancel();

    expect(machine.isCurrent(transition.token)).toBe(false);
    expect(machine.state).toBe('idle');
  });
});

describe('CameraPoseStack', () => {
  it('restores the most recent immutable pose and respects its bound', () => {
    const stack = new CameraPoseStack(2);
    const first = pose('first');
    stack.push(first);
    first.position[0] = 99;
    stack.push(pose('second'));
    stack.push(pose('third'));

    expect(stack.size).toBe(2);
    expect(stack.pop()?.focusedMemoryId).toBe('third');
    expect(stack.pop()?.focusedMemoryId).toBe('second');
    expect(stack.pop()).toBeUndefined();
  });
});
