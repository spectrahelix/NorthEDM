import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { serviceClient, loadSplitSettings } from '@/utils/coordinator';
import { getStripe } from '@/utils/stripe';
import { safeOrigin } from '@/utils/safeRedirect';
import { audioSellerReady } from '@/utils/artisanAudioServer';

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const { data, error } = await serviceClient().from('artisan_sellers').select('stripe_account_id,country').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const settings = await loadSplitSettings(serviceClient());
    return NextResponse.json({ connected: !!data, ready: data ? await audioSellerReady(data.stripe_account_id) : false, country: data?.country,
      fee_bps: Number(settings.sale_owner_bps) + Number(settings.sale_coordinator_bps) });
  } catch (e) {
    console.error('Artisan payout status:', e);
    return NextResponse.json({ error: 'Artisan payouts are not available yet.' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const origin = safeOrigin(req.headers.get('origin'), req.url);
  if (req.headers.get('origin') && req.headers.get('origin') !== origin)
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const db = serviceClient();
    const body = await req.json();
    const { data: profile } = await db.from('user_profiles').select('is_artisan,stage_name').eq('id', user.id).maybeSingle();
    if (!profile?.is_artisan) return NextResponse.json({ error: 'Artisan verification is required to sell audio. Free portfolio uploads do not require payouts.' }, { status: 403 });
    const { data, error } = await db.from('artisan_sellers').select('stripe_account_id,country').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const stripe = getStripe();
    let accountId = data?.stripe_account_id as string | undefined;
    if (!accountId) {
      const country = String(body.country || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: 'Choose your actual country using its two-letter code (for example US).' }, { status: 400 });
      const account = await stripe.accounts.create({ type: 'express', country,
        email: user.email, capabilities: { transfers: { requested: true } },
        business_profile: { name: profile.stage_name || undefined, product_description: 'Licensed original audio recordings' },
        metadata: { artisan_user_id: user.id },
      }, { idempotencyKey: `artisan-seller-${user.id}-${country}` });
      const result = await db.from('artisan_sellers').upsert({ user_id: user.id, stripe_account_id: account.id, country }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (result.error) throw result.error;
      // Parallel requests must always use the account actually bound to this user.
      const { data: saved, error: readError } = await db.from('artisan_sellers').select('stripe_account_id').eq('user_id', user.id).single();
      if (readError) throw readError;
      accountId = saved.stripe_account_id;
    }
    if (body.action === 'dashboard') {
      const link = await stripe.accounts.createLoginLink(accountId!);
      return NextResponse.json({ url: link.url });
    }
    const link = await stripe.accountLinks.create({ account: accountId!, type: 'account_onboarding',
      refresh_url: `${origin}/profile/edit?stripe=refresh#artisan`,
      return_url: `${origin}/profile/edit?stripe=connected#artisan`,
    });
    return NextResponse.json({ url: link.url });
  } catch (e) {
    console.error('Artisan payout onboarding:', e);
    return NextResponse.json({ error: 'Payout setup could not start. Check your country and try again, or contact NorthEDM.' }, { status: 503 });
  }
}
