import type { MemorySource } from './memory';

export interface Constellation {
  id: string;
  source: MemorySource;
  name: string;
  description: string;
  memoryIds: string[];
  createdAt: string;
  updatedAt: string;
}
