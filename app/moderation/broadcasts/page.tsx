"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Member = { id: string; display_name: string | null; username: string | null; role: string | null };
type Group = { id: string; name: string; description: string };
type Campaign = { id: string; subject: string; created_at: string; delivered: number; skipped: number; audience_mode: string };
type Audience = "selected" | "groups" | "all";

export default function ModeratorBroadcastsPage() {
  const [members,setMembers] = useState<Member[]>([]);
  const [groups,setGroups] = useState<Group[]>([]);
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [role,setRole] = useState("");
  const [canManageGroups,setCanManageGroups] = useState(false);
  const [mode,setMode] = useState<Audience>("selected");
  const [selectedMembers,setSelectedMembers] = useState<string[]>([]);
  const [selectedGroups,setSelectedGroups] = useState<string[]>([]);
  const [subject,setSubject] = useState("");
  const [body,setBody] = useState("");
  const [page,setPage] = useState(0);
  const [count,setCount] = useState(0);
  const [search,setSearch] = useState("");
  const [searchInput,setSearchInput] = useState("");
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [forbidden,setForbidden] = useState(false);
  const [message,setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const query=new URLSearchParams({ page:String(page), q:search });
      const response=await fetch("/api/admin/member-broadcasts?"+query.toString(),{cache:"no-store"});
      if(response.status===401 || response.status===403){setForbidden(true);setLoading(false);return;}
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Unable to load broadcast tools.");
      setMembers(data.members || []);
      setGroups(data.groups || []);
      setCampaigns(data.campaigns || []);
      setCount(data.count || 0);
      setRole(data.role || "");
      setCanManageGroups(!!data.canManageGroups);
    } catch(e) {setMessage(e instanceof Error?e.message:"Cannot load broadcast tools.");}
    finally {setLoading(false);}
  },[page,search]);

  useEffect(()=>{void load();},[load]);

  function selectMember(id:string, on:boolean) {
    setSelectedMembers(existing=>on?[...new Set([...existing,id])]:existing.filter(x=>x!==id));
  }
  function selectGroup(id:string,on:boolean) {
    setSelectedGroups(existing=>on?[...new Set([...existing,id])]:existing.filter(x=>x!==id));
  }

  const audienceReady = mode==="all" || mode==="groups" && selectedGroups.length>0 || mode==="selected" && selectedMembers.length>0;
  const audienceText = mode==="all" ? "every eligible confirmed NorthEDM member" :
    mode==="groups" ? `${selectedGroups.length} selected group(s), with overlapping members deduplicated` :
      `${selectedMembers.length} selected member(s)`;

  async function send(){
    if(!audienceReady || !subject.trim() || !body.trim() || busy)return;
    if(!window.confirm(`You are about to send an individual private DM to ${audienceText}.\n\nSubject: ${subject}\n\nRecipients cannot be recalled after sending. Respect member opt-outs. Continue?`))return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/admin/member-broadcasts",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({subject,body,audience_mode:mode,recipient_ids:mode==="selected"?selectedMembers:[],group_ids:mode==="groups"?selectedGroups:[]}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Broadcast failed.");
      const results=data.results||{};
      setMessage(`Broadcast recorded: ${results.delivered??0} delivered, ${results.blocked??0} blocked, ${results.opted_out??0} opted out.`);
      setSubject("");setBody("");setSelectedMembers([]);setSelectedGroups([]);
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Broadcast failed.");}
    finally{setBusy(false);}
  }

  if(loading)return <main className="admin-surface min-h-screen p-12 text-neutral-300">Loading broadcast tools…</main>;
  if(forbidden)return <main className="admin-surface min-h-screen p-12 text-neutral-300">Moderator broadcasting permission is required. <Link href="/" className="underline">Back to NorthEDM</Link></main>;
  return <main className="admin-surface min-h-screen px-4 py-14 text-neutral-100 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <Link href={canManageGroups?"/admin/member-messaging":"/"} className="font-dm-mono text-xs text-neutral-400 hover:text-[#3AFFD4]">← {canManageGroups?"Member Messaging":"NorthEDM"}</Link>
      <p className="mt-6 font-dm-mono text-xs uppercase tracking-[0.25em] text-[#3AFFD4]">NorthEDM · Role-gated broadcasting</p>
      <h1 className="mt-2 font-bebas text-5xl tracking-wide">Community DM Broadcasts</h1>
      <p className="mt-2 text-sm text-neutral-400">Authority: {role==="archon"?"Archon":role==="warden"?"Warden":"Site Moderator"}. Send an individual DM to selected members, your administrator’s groups, or the full community. No fixed recipient limit.</p>
      {canManageGroups && <Link href="/admin/member-messaging/groups" className="mt-3 inline-block text-sm text-[#D8A5FF] underline">Manage custom member groups</Link>}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="font-bebas text-2xl">Create announcement</h2>
          <label className="mt-4 block text-xs text-neutral-400">Subject
            <input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={100}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white" placeholder="Important community update"/>
          </label>
          <label className="mt-4 block text-xs text-neutral-400">Message
            <textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={3000} rows={7}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white" placeholder="Hello NorthEDM community…"/>
          </label>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="font-dm-mono text-xs uppercase text-neutral-500">Preview</p>
            <strong className="mt-2 block text-sm">{subject||"Announcement subject"}</strong>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400">{body||"Your message appears here."}</p>
          </div>
          <button type="button" onClick={()=>void send()} disabled={busy||!audienceReady||!subject.trim()||!body.trim()}
            className="mt-5 w-full rounded-xl bg-[#3AFFD4] px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">
            {busy?"Sending…":"Review and broadcast DM"}
          </button>
          <p className="mt-3 text-xs text-neutral-500">A confirmation is required. Announcement opt-outs, blocks and duplicate protection remain enforced.</p>
        </section>
        <section className="rounded-2xl border border-[#CC00FF]/25 bg-white/[0.02] p-5">
          <h2 className="font-bebas text-2xl">Choose your audience</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {([{id:"selected",label:"Selected members"},{id:"groups",label:"Custom groups"},{id:"all",label:"All community members"}] as {id:Audience;label:string}[]).map(option=>
              <label key={option.id} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
                <input type="radio" name="audience" checked={mode===option.id} onChange={()=>setMode(option.id)}/>{option.label}
              </label>)}
          </div>
          {mode==="all" && <p className="mt-4 rounded-xl border border-[#E8FF47]/25 p-4 text-sm text-neutral-300">
            This targets every confirmed member, except your own account, those who opted out, and blocked relationships. All accounts are resolved at send time.
          </p>}
          {mode==="groups" && <div className="mt-4">
            <p className="mb-3 text-xs text-neutral-400">Select one or more groups. Members in overlapping groups receive a single message.</p>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
              {groups.map(g=><label key={g.id} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-white/5">
                <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={e=>selectGroup(g.id,e.target.checked)}/>
                <span className="min-w-0"><strong className="block text-sm">{g.name}</strong>{g.description && <span className="block truncate text-xs text-neutral-500">{g.description}</span>}</span>
              </label>)}
              {!groups.length && <p className="p-3 text-sm text-neutral-500">No admin-defined groups yet.</p>}
            </div>
          </div>}
          {mode==="selected" && <div className="mt-4">
            <form onSubmit={e=>{e.preventDefault();setPage(0);setSearch(searchInput);}} className="flex gap-2">
              <input className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
                value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Search display names"/>
              <button className="rounded-xl border border-white/20 px-3 text-xs" type="submit">Search</button>
            </form>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span>{selectedMembers.length} selected across pages</span>
              <button type="button" className="text-[#3AFFD4] underline" onClick={()=>setSelectedMembers([])}>Clear selection</button>
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10">
              {members.map(member=><label key={member.id} className="flex items-center gap-3 border-b border-white/5 p-3 hover:bg-white/5">
                <input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={e=>selectMember(member.id,e.target.checked)}/>
                <span className="truncate text-sm">{member.display_name||member.username||"Member"} {member.username && <span className="text-xs text-neutral-500">@{member.username}</span>}</span>
              </label>)}
              {!members.length && <p className="p-4 text-sm text-neutral-500">No matching members.</p>}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">Page {page+1} · {count.toLocaleString()} matching accounts</p>
              <div className="flex gap-2">
                <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">Previous</button>
                <button type="button" disabled={(page+1)*100>=count} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">Next</button>
              </div>
            </div>
          </div>}
          <p className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Audience: {audienceText}</p>
        </section>
      </div>
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="font-bebas text-2xl">Recent broadcasts</h2>
        <div className="mt-4 space-y-2">
          {campaigns.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-3 text-sm">
            <span className="min-w-0 truncate">{c.subject} <span className="text-xs text-neutral-500">({c.audience_mode})</span></span>
            <span className="font-dm-mono text-xs text-neutral-500">{c.delivered} delivered · {c.skipped} skipped · {new Date(c.created_at).toLocaleDateString()}</span>
          </div>)}
          {!campaigns.length && <p className="text-sm text-neutral-500">No announcements yet.</p>}
        </div>
      </section>
      {message && <div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-white/20 bg-[#211827] px-4 py-3 text-sm shadow-xl">
        {message} <button type="button" className="ml-3 text-[#3AFFD4] underline" onClick={()=>setMessage("")}>Dismiss</button>
      </div>}
    </div>
  </main>;
}
