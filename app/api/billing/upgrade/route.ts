import { NextResponse } from 'next/server';
import { guardStoreOperator } from '@/utils/store';
import { safeOrigin } from '@/utils/safeRedirect';
import { cancelStoreUpgrade, requestStoreUpgrade, storeUpgradeStatus } from '@/utils/storePlanUpgrade';

async function owner(slug: string) {
  const access = await guardStoreOperator(slug);
  if (!access.ok) return { response: NextResponse.json({ error: access.error }, { status: access.status }) };
  if (access.store.owner_user_id !== access.userId) {
    return { response: NextResponse.json({ error: 'Only the store owner can authorize an upgrade.' }, { status: 403 }) };
  }
  return { access };
}

function billingError(error: unknown) {
  if (error instanceof Error && !('type' in error)) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error('Store upgrade request failed:', error instanceof Error ? error.name : error);
  return NextResponse.json({ error: 'Stripe could not complete that request. Check upgrade status before trying again.' }, { status: 502 });
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('storeSlug') ?? '';
  const { access, response } = await owner(slug);
  if (response) return response;
  try {
    return NextResponse.json(await storeUpgradeStatus(access.admin, access.store), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return billingError(error);
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== safeOrigin(origin, req.url)) {
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const { access, response } = await owner(typeof body?.storeSlug === 'string' ? body.storeSlug : '');
  if (response) return response;
  try {
    if (body?.action === 'cancel') return NextResponse.json(await cancelStoreUpgrade(access.admin, access.store));
    if (body?.action === 'preview') return NextResponse.json(await requestStoreUpgrade(access.admin, access.store, body.slots));
    if (body?.action === 'confirm' && body.consent && typeof body.consent === 'object') {
      return NextResponse.json(await requestStoreUpgrade(access.admin, access.store, body.slots, body.consent));
    }
    return NextResponse.json({ error: 'Choose an upgrade and review its price.' }, { status: 400 });
  } catch (error) {
    return billingError(error);
  }
}
