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
  const [campground, setCampground] = useState("");
  const [subCampground, setSubCampground] = useState("");
  const [campsiteRow, setCampsiteRow] = useState("");
  const [tent, setTent] = useState("");
  const [campsiteNotes, setCampsiteNotes] = useState("");
  const [campsitePhotoUrl, setCampsitePhotoUrl] = useState("");
  const [carPhotoUrl, setCarPhotoUrl] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCar, setUploadingCar] = useState(false);
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  // Store credit
  const [creditBalanceCents, setCreditBalanceCents] = useState(0);
  const [useCredit, setUseCredit] = useState(true);

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

      fetch("/api/store-credit")
        .then((r) => r.json())
        .then((j) => setCreditBalanceCents(j.balanceCents ?? 0))
        .catch(() => {});
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
  const appliedCreditCents = useCredit ? Math.min(creditBalanceCents, cartTotalCents) : 0;
  const netTotalCents = cartTotalCents - appliedCreditCents;

  async function handleUpload(
    file: File,
    setUrl: (url: string) => void,
    setBusy: (b: boolean) => void
  ) {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("festdash-campsites")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`);
    } else {
      const { data } = supabase.storage.from("festdash-campsites").getPublicUrl(path);
      setUrl(data.publicUrl);
    }
    setBusy(false);
  }

  function onCampsitePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, setCampsitePhotoUrl, setUploadingPhoto);
  }
  function onCarPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, setCarPhotoUrl, setUploadingCar);
  }

  function pinCampsiteLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerLat(pos.coords.latitude);
        setCustomerLng(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enable it to pin your site."
            : "Couldn't get your location. Try again."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
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
        campgroundZone: [
          campground,
          subCampground,
          campsiteRow && `row ${campsiteRow}`,
          tent && `tent ${tent}`,
        ].filter(Boolean).join(", "),
        campground,
        subCampground,
        campsiteRow,
        tent,
        campsiteNotes,
        campsitePhotoUrl,
        carPhotoUrl,
        licensePlate,
        customerPhone,
        customerLat,
        customerLng,
        deliveryWindow,
        items: cart.map((c) => ({ name: c.name, qty: c.qty, price: Math.round(c.price * 100) })),
        totalCents: cartTotalCents,
        useCredit,
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
                placeholder="How should the runner ask for you?"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Phone Number *</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="(570) 555-1234"
              />
              <p className="mt-1 text-xs text-neutral-600">The last 4 digits are your delivery confirmation code.</p>
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
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Campground *</label>
              <input
                value={campground}
                onChange={(e) => setCampground(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="e.g. Camp Stegosaurus"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Sub-campground / Area</label>
              <input
                value={subCampground}
                onChange={(e) => setSubCampground(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="e.g. North Loop"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Row</label>
                <input
                  value={campsiteRow}
                  onChange={(e) => setCampsiteRow(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Tent / Spot</label>
                <input
                  value={tent}
                  onChange={(e) => setTent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                  placeholder="e.g. 10 tents down"
                />
              </div>
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
                  <span className="mt-1 text-xs text-neutral-600">Helps the runner find you fast</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onCampsitePhoto} disabled={uploadingPhoto} />
                </label>
              )}
            </div>

            {/* Pin campsite GPS */}
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Pin Campsite GPS <span className="normal-case tracking-normal text-neutral-600">(best way to be found)</span>
              </label>
              {customerLat != null && customerLng != null ? (
                <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  <span>📍 Pinned ({customerLat.toFixed(4)}, {customerLng.toFixed(4)})</span>
                  <button type="button" onClick={() => { setCustomerLat(null); setCustomerLng(null); }} className="text-xs text-neutral-400 hover:text-white">Clear</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={pinCampsiteLocation}
                  disabled={locating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm text-neutral-300 transition hover:border-orange-500/40 disabled:opacity-50"
                >
                  📍 {locating ? "Getting your location…" : "Pin my campsite location"}
                </button>
              )}
              {locError && <p className="mt-1 text-xs text-red-400">{locError}</p>}
              <p className="mt-1 text-xs text-neutral-600">Stand at your site and tap — your runner gets live distance to you.</p>
            </div>

            {/* Find-my-car */}
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">License Plate</label>
              <input
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="e.g. ABC-1234"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Car Photo <span className="normal-case tracking-normal text-neutral-600">(helps the runner spot you)</span>
              </label>
              {carPhotoUrl ? (
                <div className="relative">
                  <img src={carPhotoUrl} alt="Car" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  <button
                    onClick={() => setCarPhotoUrl("")}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 py-8 text-center transition hover:border-orange-500/40">
                  <span className="mb-2 text-2xl">🚗</span>
                  <span className="text-sm text-neutral-400">
                    {uploadingCar ? "Uploading…" : "Snap a photo of your car + plate"}
                  </span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onCarPhoto} disabled={uploadingCar} />
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
              disabled={!eventName || !campground || !customerPhone || !deliveryWindow || (eventName === "Local Market / Other" && !customEvent)}
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
            <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
              {creditBalanceCents > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Subtotal</span>
                    <span className="text-neutral-300">${cartTotal.toFixed(2)}</span>
                  </div>
                  <label className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <input
                        type="checkbox"
                        checked={useCredit}
                        onChange={(e) => setUseCredit(e.target.checked)}
                        className="h-4 w-4 accent-orange-500"
                      />
                      Use store credit (${(creditBalanceCents / 100).toFixed(2)} available)
                    </span>
                    {appliedCreditCents > 0 && (
                      <span className="text-[#39FF14]">−${(appliedCreditCents / 100).toFixed(2)}</span>
                    )}
                  </label>
                </>
              )}
              <div className="flex justify-between font-semibold">
                <span className="text-white">Total</span>
                <span className="text-orange-400">${(netTotalCents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Delivery</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Name</span><span className="text-white">{customerName}</span></div>
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Phone</span><span className="text-white">{customerPhone}</span></div>
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Event</span><span className="text-white">{eventName === "Local Market / Other" ? customEvent : eventName}</span></div>
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Campsite</span><span className="text-white">{[campground, subCampground, campsiteRow && `row ${campsiteRow}`, tent && `tent ${tent}`].filter(Boolean).join(", ")}</span></div>
              {campsiteNotes && <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Notes</span><span className="text-white">{campsiteNotes}</span></div>}
              {licensePlate && <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Plate</span><span className="uppercase text-white">{licensePlate}</span></div>}
              <div className="flex gap-2"><span className="text-neutral-500 w-28 shrink-0">Window</span><span className="text-white">{deliveryWindow}</span></div>
              {(campsitePhotoUrl || carPhotoUrl) && (
                <div className="mt-2 flex gap-2">
                  {campsitePhotoUrl && <img src={campsitePhotoUrl} alt="Campsite" className="rounded-xl object-cover" style={{ maxHeight: 100 }} />}
                  {carPhotoUrl && <img src={carPhotoUrl} alt="Car" className="rounded-xl object-cover" style={{ maxHeight: 100 }} />}
                </div>
              )}
            </div>
          </div>

          {/* Payment + confirmation notice */}
          <div className="rounded-2xl border border-orange-500/20 bg-orange-950/20 p-4 text-sm text-orange-300">
            🔒 Secure prepayment (held in escrow until your order is delivered) is coming soon.
            On delivery, give your runner the <span className="font-semibold">last 4 digits of your phone</span> to confirm.
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
