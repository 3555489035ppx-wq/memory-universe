import type { MemorySource } from './memory';

export interface Place {
  id: string;
  source: MemorySource;
  name: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}
