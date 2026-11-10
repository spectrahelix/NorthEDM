import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { serviceClient } from '@/utils/coordinator';
import { getStripe } from '@/utils/stripe';
import { safeOrigin } from '@/utils/safeRedirect';
import { reconcileAudioOrder } from '@/utils/artisanAudioServer';

export async function GET(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view recordings.' }, { status: 401 });
  try {
    const db = serviceClient();
    const selling = new URL(req.url).searchParams.get('selling') === '1';
    const { data, error } = await db.from('artisan_audio_orders')
      .select('id,title,license,price_cents,fee_cents,currency,status,created_at')
      .eq(selling ? 'seller_user_id' : 'buyer_user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    // Downloads recheck the actual charge. Only recent unconfirmed checkouts need
    // reconciliation here; never make hundreds of Stripe calls to render a list.
    await Promise.all((data ?? []).filter(order => order.status === 'pending').slice(0, 5)
      .map(order => reconcileAudioOrder(db, order.id)));
    const { data: fresh, error: readError } = await db.from('artisan_audio_orders')
      .select('id,title,license,price_cents,fee_cents,currency,status,created_at')
      .eq(selling ? 'seller_user_id' : 'buyer_user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (readError) throw readError;
    return NextResponse.json({ orders: fresh }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('Artisan purchases:', e);
    return NextResponse.json({ error: 'Recordings could not be loaded. Try again shortly.' }, { status: 503 });
  }
}

// A creator can issue a full refund for their own audio sale. Customers contact
// support for a dispute; no route trusts a buyer-supplied seller or payment ID.
export async function POST(req: Request) {
  const origin = safeOrigin(req.headers.get('origin'), req.url);
  if (req.headers.get('origin') && req.headers.get('origin') !== origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const { orderId } = await req.json();
    const db = serviceClient();
    const { data: order, error } = await db.from('artisan_audio_orders').select('*').eq('id', orderId).eq('seller_user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!order || !order.payment_intent_id || !['paid','refund_pending','refunded'].includes(order.status))
      return NextResponse.json({ error: 'This sale cannot be refunded here.' }, { status: 409 });
    if (order.status === 'refunded') return NextResponse.json({ status: 'refunded' });
    const stripe = getStripe();
    // Keep known pending refunds attached; never create a second one on a retry.
    let refund = order.refund_id ? await stripe.refunds.retrieve(order.refund_id) : null;
    if (!refund || ['failed','canceled'].includes(refund.status || '')) {
      const { error: writeError } = await db.from('artisan_audio_orders').update({ status: 'refund_pending' }).eq('id', order.id).in('status', ['paid','refund_pending']);
      if (writeError) throw writeError;
      refund = await stripe.refunds.create({ payment_intent: order.payment_intent_id, reverse_transfer: true, refund_application_fee: true,
        metadata: { audio_order_id: order.id },
      }, { idempotencyKey: `artisan-refund-${order.id}-${order.refund_id || 'first'}` });
    }
    const status = refund.status === 'succeeded' ? 'refunded' : 'refund_pending';
    const { error: writeError } = await db.from('artisan_audio_orders').update({ status, refund_id: refund.id })
      .eq('id', order.id).in('status', ['paid','refund_pending','refunded']);
    if (writeError) throw writeError;
    return NextResponse.json({ status });
  } catch (e) {
    console.error('Artisan refund:', e);
    return NextResponse.json({ error: 'Refund could not be confirmed. Refresh or retry; an existing refund will be reused.' }, { status: 503 });
  }
}
