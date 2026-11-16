import type { MessageKind } from '@/domain/messages';

/** One message the step-by-step sender opens in WhatsApp. */
export type QueuedMessage = {
  customerId: number;
  name: string;
  phone: string;
  text: string;
  kind: MessageKind;
  ref?: string | number;
};

/**
 * The messages waiting for the step-by-step sender (I4), kept in memory only: they are made from
 * the shop's data each time, so nothing is lost if the app closes, the owner just chooses again.
 */
let queue: QueuedMessage[] = [];
let title = '';

export function setQueue(next: QueuedMessage[], heading: string) {
  queue = next.filter((m) => m.phone && m.text.trim());
  title = heading;
}

export const getQueue = () => ({ messages: queue, title });

export function clearQueue() {
  queue = [];
  title = '';
}
