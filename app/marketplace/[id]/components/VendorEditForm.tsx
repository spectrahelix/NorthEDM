"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type VendorFields = {
  name: string;
  description: string;
  category: string;
  contact: string;
  email: string;
  website: string;
  phone: string;
  showPhone: boolean;
};

export function VendorEditForm({
  vendorId,
  initial,
}: {
  vendorId: number;
  initial: VendorFields;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<VendorFields>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function set(key: keyof VendorFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!fields.name.trim()) {
      setError("Name is required.");
      return;
    }
    setError("");
    setSaving(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to edit this listing.");
      setSaving(false);
      return;
    }

    // Only update the vendor row that belongs to the current user
    const { error: dbError } = await supabase
      .from("vendors")
      .update({
        name: fields.name.trim(),
        description: fields.description.trim(),
        category: fields.category.trim(),
        contact: fields.contact.trim(),
        email: fields.email.trim(),
        website: fields.website.trim(),
        phone: fields.phone.trim(),
        show_phone: fields.showPhone,
      })
      .eq("id", vendorId)
      .eq("user_id", user.id);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[#E8FF47]/30 px-4 py-2 font-dm-mono text-xs uppercase tracking-widest text-[#E8FF47] transition hover:bg-[#E8FF47]/10"
      >
        Edit Your Listing
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-900 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-bebas text-2xl tracking-wide">Edit Listing</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-neutral-500 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {(
          [
            { key: "name", label: "Business Name" },
            { key: "category", label: "Category" },
            { key: "description", label: "Description", multiline: true },
            { key: "email", label: "Contact Email" },
            { key: "website", label: "Website" },
            { key: "phone", label: "Phone Number" },
            { key: "contact", label: "Contact Method (email / direct / phone)" },
          ] as { key: keyof VendorFields; label: string; multiline?: boolean }[]
        ).map(({ key, label, multiline }) => (
          <div key={key}>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              {label}
            </label>
            {multiline ? (
              <textarea
                value={String(fields[key])}
                onChange={(e) => set(key, e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            ) : (
              <input
                type="text"
                value={String(fields[key])}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            )}
          </div>
        ))}

        {/* Toggle: whether the phone number shows on the public listing */}
        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={fields.showPhone}
            onChange={(e) => setFields((f) => ({ ...f, showPhone: e.target.checked }))}
          />
          Show my phone number on my public listing
        </label>

        {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
