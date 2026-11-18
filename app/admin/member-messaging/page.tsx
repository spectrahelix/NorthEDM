"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Campaign = { id: string; subject: string; created_at: string; delivered: number; skipped: number };
type Template = { id: number; title: string; subject: string; body: string; active: boolean };
type Settings = { enabled: boolean; sender_id: string | null };
const input = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-100";
export default function MemberMessagingPage() {
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [templates,setTemplates] = useState<Template[]>([]);
  const [settings,setSettings] = useState<Settings>({ enabled:false,sender_id:null });
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [message,setMessage] = useState("");
  const [denied,setDenied] = useState(false);

  const load = useCallback(async () => {
    const [m,w] = await Promise.all([fetch("/api/admin/member-broadcasts",{cache:"no-store"}),fetch("/api/admin/welcome-dms",{cache:"no-store"})]);
    if ([401,403].includes(m.status) || [401,403].includes(w.status)) {setDenied(true);setLoading(false);return;}
    const [a,b] = await Promise.all([m.json(),w.json()]);
    if(!m.ok || !w.ok) {setMessage(a.error || b.error || "Could not load message settings.");setLoading(false);return;}
    setCampaigns(a.campaigns || []);setSettings(b.settings);setTemplates(b.templates || []);
    setLoading(false);
  },[]);
  useEffect(()=>{void load()},[load]);

  async function update(url:string,payload:Record<string,unknown>){
    setBusy(true);setMessage("");
    try{
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||"Request failed");
      await load();
      return data;
    } catch(e) {setMessage(e instanceof Error?e.message:"Request failed");return null}
    finally{setBusy(false)}
  }
  if(loading) return <main className="admin-surface min-h-screen p-10 text-neutral-300">Loading member messaging…</main>;
  if(denied) return <main className="admin-surface min-h-screen p-10 text-neutral-300">Administrator access required.</main>;
  return <main className="admin-surface min-h-screen px-5 py-14 text-neutral-100">
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="font-dm-mono text-xs text-neutral-400 hover:text-[#3AFFD4]">← Control Room</Link>
      <p className="mt-6 font-dm-mono text-xs uppercase tracking-[0.25em] text-[#3AFFD4]">NorthEDM · Admin</p>
      <h1 className="mt-2 font-bebas text-5xl tracking-wide">Member Messaging Center</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-400">Set four rotating, one-time welcome DMs for newly verified accounts and deliver direct announcements to selected community members. No welcomes on later logins.</p>

      <section className="mt-8 rounded-2xl border border-[#CC00FF]/20 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bebas text-2xl">Automated signup welcome</h2>
          <button disabled={busy} onClick={() => void update("/api/admin/welcome-dms",{action:"settings",enabled:!settings.enabled})}
            className={`rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-40 ${settings.enabled?"bg-[#39FF14] text-black":"border border-white/20 text-white"}`}>
            {settings.enabled?"Enabled — turn off":"Disabled — enable"}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Uses your administrator account as the sender. New signups receive one randomly distributed active version after verification. Existing members are not retroactively messaged.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {templates.map(t=><div key={t.id} className="rounded-xl border border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-dm-mono text-xs text-[#D9A5FF]">Welcome variation {t.id}</p>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.active} onChange={e=>setTemplates(old=>old.map(x=>x.id===t.id?{...x,active:e.target.checked}:x))}/> Active</label>
            </div>
            <label className="block text-xs text-neutral-400">Internal name<input className={`mt-1 ${input}`} value={t.title} maxLength={100} onChange={e=>setTemplates(old=>old.map(x=>x.id===t.id?{...x,title:e.target.value}:x))}/></label>
            <label className="mt-3 block text-xs text-neutral-400">DM subject<input className={`mt-1 ${input}`} value={t.subject} maxLength={100} onChange={e=>setTemplates(old=>old.map(x=>x.id===t.id?{...x,subject:e.target.value}:x))}/></label>
            <label className="mt-3 block text-xs text-neutral-400">Message body<textarea className={`mt-1 min-h-52 ${input}`} value={t.body} maxLength={3000} onChange={e=>setTemplates(old=>old.map(x=>x.id===t.id?{...x,body:e.target.value}:x))}/></label>
            <p className="mt-2 text-[11px] text-neutral-500">Use <code>{"{name}"}</code> to greet the member by their display name. Links appear as readable paths.</p>
            <button disabled={busy} onClick={() => void update("/api/admin/welcome-dms",{action:"template",...t})} className="mt-3 rounded-xl bg-[#CC00FF]/25 px-4 py-2 text-xs text-[#E9BDFF] disabled:opacity-50">Save variation {t.id}</button>
          </div>)}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/moderation/broadcasts" className="rounded-2xl border border-[#3AFFD4]/25 bg-white/[0.02] p-6 hover:bg-white/[0.05]">
          <h2 className="font-bebas text-2xl text-[#3AFFD4]">Broadcast private DMs</h2>
          <p className="mt-2 text-sm text-neutral-400">Send to selected members, your own groups, or the whole community. No artificial recipient limit. Warden and Site Moderator roles can use this tool.</p>
        </Link>
        <Link href="/admin/member-messaging/groups" className="rounded-2xl border border-[#CC00FF]/25 bg-white/[0.02] p-6 hover:bg-white/[0.05]">
          <h2 className="font-bebas text-2xl text-[#DCA5FF]">Manage member groups</h2>
          <p className="mt-2 text-sm text-neutral-400">Create private admin-defined groups and organize members for targeted broadcasts. A member can belong to multiple groups.</p>
        </Link>
      </section>
      <section className="mt-8 rounded-2xl border border-white/10 p-5">
        <h2 className="font-bebas text-2xl">Recent announcements</h2>
        <div className="mt-3 space-y-2 text-sm">
          {campaigns.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-white/10 py-3">
            <span>{c.subject}</span><span className="font-dm-mono text-xs text-neutral-500">{c.delivered} delivered · {c.skipped} skipped · {new Date(c.created_at).toLocaleDateString()}</span>
          </div>)}
          {!campaigns.length && <p className="text-neutral-500">No broadcasts yet.</p>}
        </div>
      </section>
      {message&&<div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-white/20 bg-[#251c30] px-5 py-4 text-sm shadow-xl">{message}<button onClick={()=>setMessage("")} className="ml-3 text-[#3AFFD4] underline">Dismiss</button></div>}
    </div>
  </main>;
}
