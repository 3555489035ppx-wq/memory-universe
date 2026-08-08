import type { UniverseView } from '../../engine/layout/layoutTypes';

export type CameraState =
  | 'idle'
  | 'navigating'
  | 'focusing'
  | 'diving'
  | 'inside-memory'
  | 'echoing'
  | 'returning'
  | 'reduced-transition';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  near: number;
  far: number;
  view: UniverseView;
  focusedMemoryId: string | null;
}

export class CameraPoseStack {
  readonly #poses: CameraPose[] = [];
  readonly #limit: number;

  public constructor(limit = 8) {
    this.#limit = Math.max(1, limit);
  }

  public push(pose: CameraPose): void {
    this.#poses.push(structuredClone(pose));
    if (this.#poses.length > this.#limit) this.#poses.shift();
  }

  public pop(): CameraPose | undefined {
    return this.#poses.pop();
  }

  public peek(): CameraPose | undefined {
    const pose = this.#poses.at(-1);
    return pose ? structuredClone(pose) : undefined;
  }

  public clear(): void {
    this.#poses.length = 0;
  }

  public get size(): number {
    return this.#poses.length;
  }
}

export interface CameraTransition {
  token: number;
  state: CameraState;
}

export class CameraStateMachine {
  #state: CameraState = 'idle';
  #token = 0;

  public get state(): CameraState {
    return this.#state;
  }

  public begin(state: Exclude<CameraState, 'idle' | 'inside-memory'>): CameraTransition {
    this.#token += 1;
    this.#state = state;
    return { token: this.#token, state };
  }

  public complete(token: number, state: CameraState): boolean {
    if (token !== this.#token) return false;
    this.#state = state;
    return true;
  }

  public cancel(fallback: CameraState = 'idle'): number {
    this.#token += 1;
    this.#state = fallback;
    return this.#token;
  }

  public isCurrent(token: number): boolean {
    return token === this.#token;
  }
}
