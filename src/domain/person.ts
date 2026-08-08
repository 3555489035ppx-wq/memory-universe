import type { MemorySource } from './memory';

export interface Person {
  id: string;
  source: MemorySource;
  name: string;
  createdAt: string;
  updatedAt: string;
}
