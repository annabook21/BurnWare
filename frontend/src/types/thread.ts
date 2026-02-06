/**
 * Shared types for BurnWare threads
 */

import type { Message } from './message';

export interface Thread {
  thread_id: string;
  link_id: string;
  messages: Message[];
  burned: boolean;
}
