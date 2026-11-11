import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/utils/stripe';
import { validAudioPayment, audioRefundState } from '@/utils/artisanAudio';

// Closed by default. Only an operator database migration can open checkout after
// live provider verification; the app service role has SELECT access only.
export async function audioSalesEnabled(db: SupabaseClient) {
  const { data, error } = await db.from('artisan_audio_config').select('sales_enabled').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.sales_enabled === true;
}

export async function audioSellerReady(accountId: string) {
  const account = await getStripe().accounts.retrieve(accountId);
  return !account.deleted && !!account.details_submitted && !!account.payouts_enabled &&
    account.capabilities?.transfers === 'active';
}

export async function reconcileAudioOrder(db: SupabaseClient, orderId: string) {
  const { data: order, error } = await db.from('artisan_audio_orders').select('*').eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!order?.checkout_session_id) return false;
  if (!['pending','paid'].includes(order.status)) return false;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
  if (session.metadata?.kind !== 'artisan_audio_order' || session.metadata?.audio_order_id !== order.id ||
      session.amount_total !== order.price_cents || session.currency !== order.currency ||
      session.client_reference_id !== order.id || session.payment_status !== 'paid') return false;
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!piId || (order.payment_intent_id && piId !== order.payment_intent_id)) return false;
  const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  if (charge?.disputed || charge?.amount_refunded) {
    const refunds = charge.disputed ? null : await stripe.refunds.list({ payment_intent: piId, limit: 100 });
    const { error: writeError } = await db.from('artisan_audio_orders').update({
      status: charge.disputed ? 'disputed' : audioRefundState(refunds!.data, order.price_cents), payment_intent_id: piId,
    }).eq('id', orderId).in('status', ['pending','paid']);
    if (writeError) throw writeError;
    return false;
  }
  if (!validAudioPayment(order, pi)) return false;
  const { data, error: writeError } = await db.from('artisan_audio_orders').update({
    status: 'paid', payment_intent_id: piId, paid_at: order.paid_at || new Date().toISOString(),
  }).eq('id', orderId).in('status', ['pending','paid']).select('status').maybeSingle();
  if (writeError) throw writeError;
  return data?.status === 'paid';
}

export async function handleAudioEvent(db: SupabaseClient, event: Stripe.Event) {
  const object = event.data.object;
  if (event.type === 'checkout.session.completed') {
    const session = object as Stripe.Checkout.Session;
    if (session.metadata?.kind !== 'artisan_audio_order') return false;
    if (session.metadata.audio_order_id) await reconcileAudioOrder(db, session.metadata.audio_order_id);
    return true;
  }
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const obj = object as Stripe.Charge | Stripe.Dispute;
    const intent = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id;
    if (intent) {
      const { data: order, error: readError } = await db.from('artisan_audio_orders').select('id,price_cents').eq('payment_intent_id', intent).maybeSingle();
      if (readError) throw readError;
      if (!order) return false;
      const refunds = event.type === 'charge.dispute.created' ? null : await getStripe().refunds.list({ payment_intent: intent, limit: 100 });
      const { error } = await db.from('artisan_audio_orders').update({
        status: event.type === 'charge.dispute.created' ? 'disputed' : audioRefundState(refunds!.data, order.price_cents),
      }).eq('payment_intent_id', intent).in('status', ['pending','paid','refund_pending']);
      if (error) throw error;
    }
    // Other checkout features may share the same event: do not swallow it.
  }
  return false;
}
