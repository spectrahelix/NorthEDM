"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: number;
  currentType: string;
  currentPublic: boolean;
};

export default function VendorActionButtons({
  id,
  currentType,
  currentPublic,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateVendor(
    status: string,
    vendorType = currentType,
    isPublic = currentPublic
  ) {
    setLoading(true);

    try {
      const res = await fetch("/api/vendors/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status,
          vendorType,
          isPublic,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update vendor");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Could not update vendor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={() => updateVendor("approved")}
        disabled={loading}
        className="rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-300 disabled:opacity-50"
      >
        Approve
      </button>

      <button
        onClick={() => updateVendor("rejected")}
        disabled={loading}
        className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-300 disabled:opacity-50"
      >
        Reject
      </button>

      <button
        onClick={() => updateVendor("approved", "listed", true)}
        disabled={loading}
        className="rounded-xl bg-blue-500/20 px-3 py-2 text-sm text-blue-300 disabled:opacity-50"
      >
        Make Listed
      </button>

      <button
        onClick={() => updateVendor("approved", "featured", true)}
        disabled={loading}
        className="rounded-xl bg-purple-500/20 px-3 py-2 text-sm text-purple-300 disabled:opacity-50"
      >
        Make Featured
      </button>

      <button
        onClick={() => updateVendor("approved", "private", false)}
        disabled={loading}
        className="rounded-xl bg-yellow-500/20 px-3 py-2 text-sm text-yellow-300 disabled:opacity-50"
      >
        Make Private
      </button>
    </div>
  );
}