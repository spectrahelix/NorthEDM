"use client";
import { useRef, useState } from "react";

/**
 * Client half of `shieldForm` (utils/botSignals.ts). `shield()` gives the two
 * fields to spread into a JSON body (or append to FormData); `<Honeypot/>` is
 * the hidden field people never see and bots fill in.
 */
export function useFormShield() {
  const loadedAt = useRef(Date.now());
  const [hp, setHp] = useState("");
  const shield = () => ({ company_website: hp, elapsedMs: Date.now() - loadedAt.current });
  const honeypot = { value: hp, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHp(e.target.value) };
  return { shield, honeypot };
}

export function Honeypot({ value, onChange }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Company website
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" value={value} onChange={onChange} />
      </label>
    </div>
  );
}
