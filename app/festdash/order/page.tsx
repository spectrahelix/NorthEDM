"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type Vendor = { id: number; name: string; category: string; description: string };
type MenuItem = { id: number; name: string; description: string; price: number; image_url: string | null; category: string };
type CartItem = MenuItem & { qty: number };

const NE_EVENTS = [
  "Elements Music & Arts Festival",
  "Rootwire Transformational Arts Festival",
  "Disc Jam Music Festival",
  "Strange Creek Campout",
  "Wormtown Music Festival",
  "Resonance Music Festival",
  "Catskill Chill Music Festival",
  "Local Market / Other",
];

const DELIVERY_WINDOWS = [
  "ASAP (next 30 min)",
  "30 min – 1 hour",
  "1:00 – 1:30 PM", "1:30 – 2:00 PM",
  "2:00 – 2:30 PM", "2:30 – 3:00 PM",
  "3:00 – 3:30 PM", "3:30 – 4:00 PM",
  "4:00 – 4:30 PM", "4:30 – 5:00 PM",
  "5:00 – 5:30 PM", "5:30 – 6:00 PM",
  "6:00 – 6:30 PM", "6:30 – 7:00 PM",
  "7:00 – 7:30 PM", "7:30 – 8:00 PM",
  "8:00 – 9:00 PM", "9:00 – 10:00 PM",
];

export default function OrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Delivery info
  const [eventName, setEventName] = useState("");
  const [customEvent, setCustomEvent] = useState("");
  const [campgroundZone, setCampgroundZone] = useState("");
  const [campsiteNotes, setCampsiteNotes] = useState("");
  const [campsitePhotoUrl, setCampsitePhotoUrl] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthed(false); setLoadingVendors(false); return; }
      setAuthed(true);
      if (user.email) setCustomerName(user.email.split("@")[0]);

      const res = await fetch("/api/festdash/vendors");
      const json = await res.json();
      setVendors(json.vendors ?? []);
      setLoadingVendors(false);
    })();
  }, [supabase]);

  async function selectVendor(vendor: Vendor) {
    setSelectedVendor(vendor);
    setCart([]);
    setLoadingMenu(true);
    const res = await fetch(`/api/festdash/menu/${vendor.id}`);
    const json = await res.json();
    setMenuItems(json.items ?? []);
    setLoadingMenu(false);
    setStep(2);
  }

  function adjustCart(item: MenuItem, delta: number) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (!existing && delta > 0) return [...prev, { ...item, qty: 1 }];
      return prev
        .map((c) => c.id === item.id ? { ...c, qty: c.qty + delta } : c)
        .filter((c) => c.qty > 0);
    });
  }

  function qtyFor(id: number) {
    return cart.find((c) => c.id === id)?.qty ?? 0;
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartTotalCents = Math.round(cartTotal * 100);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("festdash-campsites")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`);
    } else {
      const { data } = supabase.storage.from("festdash-campsites").getPublicUrl(path);
      setCampsitePhotoUrl(data.publicUrl);
    }
    setUploadingPhoto(false);
  }

  async function submitOrder() {
    setSubmitting(true);
    setError("");
    const finalEvent = eventName === "Local Market / Other" ? customEvent : eventName;

    const res = await fetch("/api/festdash/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: selectedVendor!.id,
        eventName: finalEvent,
        campgroundZone,
        campsiteNotes,
        campsitePhotoUrl,
        deliveryWindow,
        items: cart.map((c) => ({ name: c.name, qty: c.qty, price: Math.round(c.price * 100) })),
        totalCents: cartTotalCents,
        customerName,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to place order.");
      setSubmitting(false);
      return;
    }

    router.push(`/festdash/track/${json.order.id}`);
  }

  // ── Auth gate ────────────────────────────────────────────────────
  if (authed === false) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🎪</div>
          <h2 className="mb-2 font-bebas text-3xl tracking-wide text-white">Sign in to Order</h2>
          <p className="mb-6 text-neutral-500">You need a NorthEDM account to place a FestDash order.</p>
          <a
            href={`/login?next=${encodeURIComponent("/festdash/order")}`}
            className="inline-block rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400"
          >
            Sign In
          </a>
          <a href="/signup" className="mt-3 block text-sm text-neutral-500 hover:text-neutral-300">
            Don&apos;t have an account? Sign up →
          </a>
        </div>
      </main>
    );
  }

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-dm-mono text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  // ── Step 1: Choose vendor ───────────────────────────────────────
  if (step === 1) {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <button onClick={() => router.push("/festdash")} className="mb-6 font-dm-mono text-xs text-neutral-500 hover:text-white">
            ← Back to FestDash
          </button>
          <h1 className="mb-2 font-bebas text-5xl tracking-wide text-white">
            Choose a <span className="text-orange-400">Vendor</span>
          </h1>
          <p className="mb-8 text-neutral-500">Select who you want to order from.</p>

          {loadingVendors ? (
            <div className="py-16 text-center font-dm-mono text-sm text-neutral-500">Loading vendors…</div>
          ) : vendors.length === 0 ? (
            <div className="rounded-2xl border border-white/8 py-16 text-center">
              <p className="text-neutral-500">No FestDash vendors active yet.</p>
              <p className="mt-1 text-sm text-neutral-600">Check back soon — vendors are joining the network.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vendors.map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectVendor(v)}
                  className="w-full rounded-2xl border border-white/8 bg-white/3 p-5 text-left transition hover:border-orange-500/40 hover:bg-orange-950/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{v.name}</p>
                      <p className="text-sm text-neutral-500">{v.category}</p>
                    </div>
                    <span className="rounded-full bg-orange-500/15 px-3 py-1 font-dm-mono text-xs text-orange-400">
                      Order →
                    </span>
                  </div>
                  {v.description && (
                    <p className="mt-2 text-sm text-neutral-400 line-clamp-2">{v.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Step 2: Browse menu + build cart ───────────────────────────
  if (step === 2) {
    const categories = [...new Set(menuItems.map((i) => i.category))];
    return (
      <main className="min-h-screen px-6 pb-40 pt-16">
        <div className="mx-auto max-w-2xl">
          <button onClick={() => setStep(1)} className="mb-6 font-dm-mono text-xs text-neutral-500 hover:text-white">
            ← Back
          </button>
          <h1 className="mb-1 font-bebas text-4xl tracking-wide text-white">{selectedVendor?.name}</h1>
          <p className="mb-8 text-neutral-500">Add items to your order.</p>

          {loadingMenu ? (
            <div className="py-16 text-center font-dm-mono text-sm text-neutral-500">Loading menu…</div>
          ) : menuItems.length === 0 ? (
            <div className="rounded-2xl border border-white/8 py-12 text-center">
              <p className="text-neutral-500">No menu items available right now.</p>
            </div>
          ) : (
            <>
              {categories.map((cat) => (
                <div key={cat} className="mb-8">
                  <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{cat}</h2>
                  <div className="space-y-3">
                    {menuItems.filter((i) => i.category === cat).map((item) => {
                      const qty = qtyFor(item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/3 p-4">
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-neutral-500 line-clamp-2">{item.description}</p>
                            )}
                            <p className="mt-1 text-sm text-orange-400">${item.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {qty > 0 ? (
                              <>
                                <button onClick={() => adjustCart(item, -1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white hover:bg-white/5">−</button>
                                <span className="w-5 text-center font-semibold text-white">{qty}</span>
                                <button onClick={() => adjustCart(item, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-400">+</button>
                              </>
                            ) : (
                              <button onClick={() => adjustCart(item, 1)} className="rounded-xl bg-orange-500/15 px-4 py-2 font-dm-mono text-xs text-orange-400 hover:bg-orange-500/25">Add</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Sticky cart bar */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-neutral-950/95 p-4 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-center justify-between">
              <div>
                <p className="text-sm text-neutral-400">{cart.reduce((s, c) => s + c.qty, 0)} items</p>
                <p className="font-semibold text-white">${cartTotal.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400"
              >
                Continue to Delivery →
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ── Step 3: Delivery info ───────────────────────────────────────
  if (step === 3) {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-lg">
          <button onClick={() => setStep(2)} className="mb-6 font-dm-mono text-xs text-neutral-500 hover:text-white">
            ← Back to menu
          </button>
          <h1 className="mb-2 font-bebas text-4xl tracking-wide text-white">Delivery <span className="text-orange-400">Details</span></h1>
          <p className="mb-8 text-neutral-500">Tell us where to find you.</p>

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your Name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="How should the driver ask for you?"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Event *</label>
              <select
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none"
              >
                <option value="">Select your event…</option>
                {NE_EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              {eventName === "Local Market / Other" && (
                <input
                  value={customEvent}
                  onChange={(e) => setCustomEvent(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Event name"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Campground Zone / Section *</label>
              <input
                value={campgroundZone}
                onChange={(e) => setCampgroundZone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="e.g. Camp B, Site 14 — or Main Stage Left"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Additional Landmark Notes</label>
              <textarea
                rows={2}
                value={campsiteNotes}
                onChange={(e) => setCampsiteNotes(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="Blue tent near the oak tree, green van with flowers painted on it…"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Campsite Photo <span className="normal-case tracking-normal text-neutral-600">(recommended)</span>
              </label>
              {campsitePhotoUrl ? (
                <div className="relative">
                  <img src={campsitePhotoUrl} alt="Campsite" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  <button
                    onClick={() => setCampsitePhotoUrl("")}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 py-8 text-center transition hover:border-orange-500/40">
                  <span className="mb-2 text-2xl">📸</span>
                  <span className="text-sm text-neutral-400">
                    {uploadingPhoto ? "Uploading…" : "Snap a photo of your campsite or car"}
                  </span>
                  <span className="mt-1 text-xs text-neutral-600">Helps the driver find you fast</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhoto} disabled={uploadingPhoto} />
                </label>
              )}
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Delivery Window *</label>
              <select
                value={deliveryWindow}
                onChange={(e) => setDeliveryWindow(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none"
              >
                <option value="">When should we deliver?</option>
                {DELIVERY_WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
            )}

            <button
              disabled={!eventName || !campgroundZone || !deliveryWindow || (eventName === "Local Market / Other" && !customEvent)}
              onClick={() => setStep(4)}
              className="w-full rounded-2xl bg-orange-500 py-3.5 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-40"
            >
              Review Order →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step 4: Review + pay ────────────────────────────────────────
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-lg">
        <button onClick={() => setStep(3)} className="mb-6 font-dm-mono text-xs text-neutral-500 hover:text-white">
          ← Back
        </button>
        <h1 className="mb-2 font-bebas text-4xl tracking-wide text-white">Review <span className="text-orange-400">Order</span></h1>
        <p className="mb-8 text-neutral-500">Confirm everything looks right.</p>

        <div className="space-y-4">
          {/* Vendor */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="mb-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Vendor</p>
            <p className="font-semibold text-white">{selectedVendor?.name}</p>
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Items</p>
            {cart.map((c) => (
              <div key={c.id} className="flex justify-between py-1.5">
                <span className="text-sm text-white">{c.qty}× {c.name}</span>
                <span className="text-sm text-neutral-400">${(c.price * c.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-semibold">
              <span className="text-white">Total</span>
              <span className="text-orange-400">${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Delivery */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Delivery</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Name</span><span className="text-white">{customerName}</span></div>
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Event</span><span className="text-white">{eventName === "Local Market / Other" ? customEvent : eventName}</span></div>
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Zone / Site</span><span className="text-white">{campgroundZone}</span></div>
              {campsiteNotes && <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Notes</span><span className="text-white">{campsiteNotes}</span></div>}
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Window</span><span className="text-white">{deliveryWindow}</span></div>
              {campsitePhotoUrl && (
                <div className="mt-2">
                  <img src={campsitePhotoUrl} alt="Campsite" className="rounded-xl object-cover" style={{ maxHeight: 120 }} />
                </div>
              )}
            </div>
          </div>

          {/* Payment notice */}
          <div className="rounded-2xl border border-orange-500/20 bg-orange-950/20 p-4 text-sm text-orange-300">
            💳 Payment is collected on delivery. Have <span className="font-semibold">${cartTotal.toFixed(2)}</span> ready — cash or card accepted from your driver.
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={submitOrder}
            disabled={submitting}
            className="w-full rounded-2xl bg-orange-500 py-4 text-lg font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {submitting ? "Placing Order…" : "Place Order 🎪"}
          </button>
        </div>
      </div>
    </main>
  );
}
