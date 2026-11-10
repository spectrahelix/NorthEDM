import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { serviceClient, loadSplitSettings } from '@/utils/coordinator';
import { getStripe, platformFeeCents } from '@/utils/stripe';
import { safeOrigin } from '@/utils/safeRedirect';
import { AUDIO_MIME, audioPrice, ownAudioPath } from '@/utils/artisanAudio';
import { audioSellerReady, reconcileAudioOrder, audioSalesEnabled } from '@/utils/artisanAudioServer';

export async function GET(req: Request) {
  try {
    const db = serviceClient();
    const salesEnabled = await audioSalesEnabled(db);
    const workId = Number(new URL(req.url).searchParams.get('work'));
    if (!Number.isSafeInteger(workId) || workId <= 0) return NextResponse.json({ error: 'Invalid sample.' }, { status: 400 });
    const { data: work } = await db.from('artisan_works').select('id,user_id,kind').eq('id', workId).maybeSingle();
    if (!work || work.kind !== 'audio') return NextResponse.json({ error: 'Sample not found.' }, { status: 404 });
    const { data: offer, error } = await db.from('artisan_audio_offers').select('*').eq('work_id', workId).maybeSingle();
    if (error) throw error;
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    const owner = user?.id === work.user_id;
    const { data: profile } = await db.from('user_profiles').select('is_artisan,stage_name,display_name').eq('id', work.user_id).maybeSingle();
    const { data: seller } = await db.from('artisan_sellers').select('stripe_account_id').eq('user_id', work.user_id).maybeSingle();
    const settings = await loadSplitSettings(db);
    const feeBps = Number(settings.sale_owner_bps) + Number(settings.sale_coordinator_bps);
    const available = !!(salesEnabled && profile?.is_artisan && offer?.enabled && offer.fee_bps === feeBps && seller && await audioSellerReady(seller.stripe_account_id));
    let purchase = null;
    if (user) {
      const { data: orders, error: orderError } = await db.from('artisan_audio_orders').select('id,status').eq('work_id', workId).eq('buyer_user_id', user.id).in('status', ['pending','paid','refund_pending']).order('created_at', { ascending: false }).limit(1);
      if (orderError) throw orderError;
      purchase = orders?.[0] ?? null;
      if (purchase?.status === 'pending' || purchase?.status === 'paid') {
        await reconcileAudioOrder(db, purchase.id);
        const { data } = await db.from('artisan_audio_orders').select('id,status').eq('id', purchase.id).single();
        purchase = data;
      }
    }
    return NextResponse.json({ available, sales_enabled: salesEnabled, seller: profile?.stage_name || profile?.display_name || 'Artisan',
      ...(owner ? { fee_bps: feeBps } : {}),
      offer: offer && (owner || available) ? { price_cents: offer.price_cents, currency: offer.currency, license: offer.license,
        ...(owner ? { enabled: offer.enabled, filename: offer.filename } : {}) } : null,
      purchase, owner,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('Artisan audio status:', e);
    return NextResponse.json({ error: 'Audio sales are not available yet.' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const origin = safeOrigin(req.headers.get('origin'), req.url);
  if (req.headers.get('origin') && req.headers.get('origin') !== origin)
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  try {
    const body = await req.json();
    const db = serviceClient();
    if ((body.action === 'checkout' || (body.action === 'save' && body.enabled !== false)) && !await audioSalesEnabled(db))
      return NextResponse.json({ error: 'Recording purchases are being prepared. Portfolio samples and bank setup are available.' }, { status: 503 });
    if (body.action === 'download') {
      const { data: order, error } = await db.from('artisan_audio_orders').select('*').eq('id', body.orderId).eq('buyer_user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!order || !await reconcileAudioOrder(db, order.id)) return NextResponse.json({ error: 'A confirmed, non-refunded purchase is required.' }, { status: 403 });
      const { data, error: signError } = await db.storage.from('artisan-audio-originals').createSignedUrl(order.private_path, 60, { download: order.filename });
      if (signError) throw signError;
      return NextResponse.json({ url: data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const workId = Number(body.workId);
    if (!Number.isSafeInteger(workId) || workId <= 0) return NextResponse.json({ error: 'Invalid sample.' }, { status: 400 });
    const { data: work, error: workError } = await db.from('artisan_works').select('id,user_id,kind,title').eq('id', workId).maybeSingle();
    if (workError) throw workError;
    if (!work || work.kind !== 'audio') return NextResponse.json({ error: 'Sample not found.' }, { status: 404 });
    if (body.action === 'save') {
      if (work.user_id !== user.id) return NextResponse.json({ error: 'Only the creator can edit this recording.' }, { status: 403 });
      if (body.enabled === false) {
        const { error } = await db.from('artisan_audio_offers').update({ enabled: false }).eq('work_id', workId).eq('seller_user_id', user.id);
        if (error) throw error;
        return NextResponse.json({ saved: true });
      }
      const price = audioPrice(body.price_cents);
      const settings = await loadSplitSettings(db);
      const feeBps = Number(settings.sale_owner_bps) + Number(settings.sale_coordinator_bps);
      if (body.acceptedSellerTerms !== '2026-11-10' || body.acceptedFeeBps !== feeBps)
        return NextResponse.json({ error: 'Review the current audio seller terms and platform fee before enabling sales.' }, { status: 409 });
      const license = String(body.license || '').trim();
      if (license.length < 10 || license.length > 3000) return NextResponse.json({ error: 'Describe the buyer’s license (10–3000 characters).' }, { status: 400 });
      const { data: existing } = await db.from('artisan_audio_offers').select('private_path,filename').eq('work_id', workId).maybeSingle();
      const path = body.private_path || existing?.private_path;
      const filename = String(body.filename || existing?.filename || '').replace(/[\r\n/\\]/g, '_').slice(0, 180);
      if (!ownAudioPath(path, user.id) || !filename) return NextResponse.json({ error: 'Upload the paid original first.' }, { status: 400 });
      const { data: info, error: fileError } = await db.storage.from('artisan-audio-originals').info(path);
      if (fileError || !info?.size || info.size > 50 * 1024 * 1024 || !Object.values(AUDIO_MIME).includes(info.contentType || ''))
        return NextResponse.json({ error: 'The paid audio original is missing or unsupported.' }, { status: 400 });
      const { data: seller } = await db.from('artisan_sellers').select('stripe_account_id').eq('user_id', user.id).maybeSingle();
      const { data: profile } = await db.from('user_profiles').select('is_artisan').eq('id', user.id).maybeSingle();
      if (!profile?.is_artisan || !seller || !await audioSellerReady(seller.stripe_account_id))
        return NextResponse.json({ error: 'Complete artisan verification and Stripe bank setup before enabling sales.' }, { status: 409 });
      const { error } = await db.from('artisan_audio_offers').upsert({ work_id: workId, seller_user_id: user.id, private_path: path, filename,
        price_cents: price, currency: 'usd', license, enabled: true, terms_version: '2026-11-10', terms_accepted_at: new Date().toISOString(), fee_bps: feeBps, updated_at: new Date().toISOString() });
      if (error) throw error;
      return NextResponse.json({ saved: true });
    }
    if (body.action !== 'checkout') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    if (work.user_id === user.id) return NextResponse.json({ error: 'This is your own recording.' }, { status: 400 });
    const { data: profile } = await db.from('user_profiles').select('is_artisan').eq('id', work.user_id).maybeSingle();
    const { data: offer, error: offerError } = await db.from('artisan_audio_offers').select('*').eq('work_id', workId).eq('enabled', true).maybeSingle();
    if (offerError) throw offerError;
    const { data: seller } = await db.from('artisan_sellers').select('stripe_account_id').eq('user_id', work.user_id).maybeSingle();
    if (!profile?.is_artisan || !offer || offer.seller_user_id !== work.user_id || !seller || !await audioSellerReady(seller.stripe_account_id))
      return NextResponse.json({ error: 'This recording is not currently for sale.' }, { status: 409 });
    if (body.acceptedLicense !== offer.license || body.acceptedPrice !== offer.price_cents || body.acceptedTerms !== '2026-11-10' || body.immediateDelivery !== true)
      return NextResponse.json({ error: 'Review and accept the current price, license, and audio terms before buying.' }, { status: 409 });
    const stripe = getStripe();
    const { data: previous, error: previousError } = await db.from('artisan_audio_orders').select('*').eq('buyer_user_id', user.id).eq('work_id', workId)
      .in('status', ['pending','paid','refund_pending']).maybeSingle();
    if (previousError) throw previousError;
    if (previous) {
      if (previous.status !== 'pending' || await reconcileAudioOrder(db, previous.id))
        return NextResponse.json({ error: 'You already have a purchase for this recording. Refresh to download or check its status.' }, { status: 409 });
      if (previous.checkout_session_id) {
        const session = await stripe.checkout.sessions.retrieve(previous.checkout_session_id);
        if (session.status === 'open' && session.url) {
          if (previous.price_cents === offer.price_cents && previous.license === offer.license && previous.private_path === offer.private_path)
            return NextResponse.json({ url: session.url });
          await stripe.checkout.sessions.expire(session.id);
        } else if (session.status !== 'expired') return NextResponse.json({ error: 'Payment is being confirmed. Refresh shortly.' }, { status: 409 });
      } else if (Date.now() - new Date(previous.created_at).getTime() < 60000) {
        return NextResponse.json({ error: 'Checkout is being prepared. Try again shortly.' }, { status: 409 });
      }
      const { error } = await db.from('artisan_audio_orders').update({ status: 'canceled' }).eq('id', previous.id).eq('status', 'pending');
      if (error) throw error;
    }
    const settings = await loadSplitSettings(db);
    const bps = Math.max(0, Math.min(10000, Number(settings.sale_owner_bps) + Number(settings.sale_coordinator_bps)));
    if (!Number.isFinite(bps)) throw new Error('Invalid platform fee.');
    if (offer.fee_bps !== bps) return NextResponse.json({ error: 'This creator needs to review their current sale fee before new purchases.' }, { status: 409 });
    const { data: order, error: orderError } = await db.from('artisan_audio_orders').insert({
      work_id: workId, buyer_user_id: user.id, seller_user_id: work.user_id, title: work.title || 'Audio recording',
      private_path: offer.private_path, filename: offer.filename, license: offer.license,
      terms_version: '2026-11-10',
      immediate_delivery_requested: true,
      price_cents: audioPrice(offer.price_cents), currency: 'usd', fee_cents: platformFeeCents(offer.price_cents, bps), stripe_account_id: seller.stripe_account_id,
    }).select('*').single();
    if (orderError) throw orderError;
    const metadata = { kind: 'artisan_audio_order', audio_order_id: order.id };
    const session = await stripe.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'],
      client_reference_id: order.id, customer_email: user.email,
      metadata, payment_intent_data: { metadata, application_fee_amount: order.fee_cents, transfer_data: { destination: order.stripe_account_id } },
      line_items: [{ price_data: { currency: 'usd', unit_amount: order.price_cents, product_data: { name: order.title } }, quantity: 1 }],
      success_url: `${origin}/audio/purchases?order=${order.id}`,
      cancel_url: `${origin}/profile/${work.user_id}`,
    }, { idempotencyKey: `artisan-audio-${order.id}` });
    const { error: bindError } = await db.from('artisan_audio_orders').update({ checkout_session_id: session.id }).eq('id', order.id).eq('status', 'pending');
    if (bindError) throw bindError;
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Artisan audio action:', e);
    return NextResponse.json({ error: 'Audio checkout could not complete. Please try again or contact NorthEDM.' }, { status: 503 });
  }
}
