// Shared upload and money validation; no server credentials in this module.
export const ACCEPT_AUDIO = '.mp3,.m4a,.wav,.ogg,.flac,.aac,.webm';
export const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
  flac: 'audio/flac', aac: 'audio/aac', webm: 'audio/webm',
};
export function audioFile(file: { name: string; size: number }, original = false) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!AUDIO_MIME[ext]) throw new Error('Choose MP3, M4A, WAV, OGG, FLAC, AAC, or WebM audio.');
  if (!file.size || file.size > (original ? 50 : 15) * 1024 * 1024)
    throw new Error(`Audio must be under ${original ? 50 : 15}MB.`);
  return { ext, type: AUDIO_MIME[ext] };
}
export function audioPrice(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 50 || n > 1000000) throw new Error('Price must be between $0.50 and $10,000.');
  return n;
}
export function ownAudioPath(path: unknown, userId: string): path is string {
  return typeof path === 'string' && path.startsWith(`${userId}/`) &&
    /^[\w/-]+\.[a-z0-9]+$/.test(path) && !path.includes('..') && !path.includes('//');
}
export type AudioPaymentSnapshot = {
  id: string; price_cents: number; fee_cents: number; currency: string; stripe_account_id: string;
};
export function audioRefundState(refunds: { amount: number; status: string | null }[], price: number) {
  if (refunds.some(r => r.status === 'pending' || r.status === 'requires_action')) return 'refund_pending';
  const succeeded = refunds.filter(r => r.status === 'succeeded').reduce((sum, r) => sum + r.amount, 0);
  return succeeded >= price ? 'refunded' : succeeded > 0 ? 'partially_refunded' : 'refund_pending';
}
// Validate the provider's actual payment, not a redirect or client-supplied price.
export function validAudioPayment(order: AudioPaymentSnapshot, pi: {
  status: string; amount: number; amount_received: number; currency: string;
  application_fee_amount?: number | null; metadata: Record<string, string>;
  transfer_data?: { destination: string | { id: string } } | null;
  latest_charge?: string | { paid: boolean; refunded: boolean; amount_refunded: number; disputed: boolean } | null;
}) {
  const dest = pi.transfer_data?.destination;
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  return pi.status === 'succeeded' && pi.amount === order.price_cents &&
    pi.amount_received === order.price_cents && pi.currency === order.currency &&
    pi.application_fee_amount === order.fee_cents &&
    (typeof dest === 'string' ? dest : dest?.id) === order.stripe_account_id &&
    pi.metadata.kind === 'artisan_audio_order' && pi.metadata.audio_order_id === order.id &&
    !!charge?.paid && !charge.refunded && !charge.amount_refunded && !charge.disputed;
}
