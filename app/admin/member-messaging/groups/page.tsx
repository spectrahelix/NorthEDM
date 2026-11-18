"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Group = { id: string; name: string; description: string; created_at: string };
type Member = { id: string; display_name: string | null; username: string | null; role: string | null };
const field = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-100";

export default function MemberGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), q: search });
    if (selected) params.set("group_id", selected);
    try {
      const response = await fetch("/api/admin/member-groups?" + params, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load groups.");
      setGroups(data.groups || []);
      setMembers(data.members || []);
      setMemberships(data.memberships || []);
      setAssignedCount(data.assigned_count ?? 0);
      setTotal(data.total ?? 0);
      if (selected && !(data.groups || []).some((g: Group) => g.id === selected)) setSelected("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load group data."); }
    finally { setLoading(false); }
  }, [selected, page, search]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/admin/member-groups", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      await load();
      return data;
    } catch(e) { setError(e instanceof Error ? e.message : "Action failed."); return null; }
    finally { setBusy(false); }
  }

  function choose(group: Group) {
    setSelected(group.id);
    setEditName(group.name);
    setEditDescription(group.description);
    setPage(0);
  }

  async function create() {
    const result = await mutate({ action: "create", name: newName, description: newDescription });
    if (result) {
      setNewName(""); setNewDescription(""); setSelected(result.id); setPage(0);
      setEditName(newName.trim()); setEditDescription(newDescription.trim());
      setNotice("Group created. You can now assign members.");
    }
  }

  async function assign(memberId: string, assigned: boolean) {
    const result = await mutate({ action: "membership", group_id: selected, member_id: memberId, assigned });
    if (result) setNotice(assigned ? "Member added to group." : "Member removed from group.");
  }

  const active = groups.find(g => g.id === selected);
  return <main className="admin-surface min-h-screen px-4 py-14 text-neutral-100 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/member-messaging" className="font-dm-mono text-xs text-neutral-400 hover:text-[#3AFFD4]">← Member Messaging Center</Link>
      <p className="mt-6 font-dm-mono text-xs uppercase tracking-[0.25em] text-[#3AFFD4]">NorthEDM · Private admin tools</p>
      <h1 className="mt-2 font-bebas text-5xl tracking-wide">Custom Member Groups</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-400">
        Organize members by your own labels: DJs, vendors, artists, promoters, event-goers or anything else.
        Members can belong to multiple groups. Groups are private and never change their site permissions.
      </p>
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#CC00FF]/25 bg-white/[0.02] p-5">
            <h2 className="font-bebas text-2xl tracking-wide">Create a group</h2>
            <label className="mt-4 block text-xs text-neutral-400">Group name
              <input className={`mt-1 ${field}`} value={newName} maxLength={100} onChange={e => setNewName(e.target.value)} placeholder="Local DJs"/>
            </label>
            <label className="mt-3 block text-xs text-neutral-400">Description (optional)
              <textarea className={`mt-1 ${field}`} value={newDescription} maxLength={1000} rows={2} onChange={e=>setNewDescription(e.target.value)} placeholder="DJs and music producers in the Northeast"/>
            </label>
            <button type="button" disabled={busy || !newName.trim()} onClick={() => void create()} className="mt-4 rounded-xl bg-[#CC00FF] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Create group</button>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="px-1 font-bebas text-2xl tracking-wide">Your groups</h2>
            <div className="mt-3 space-y-2">
              {groups.map(group => <button key={group.id} type="button" onClick={() => choose(group)}
                className={`w-full rounded-xl border p-3 text-left transition ${selected === group.id ? "border-[#3AFFD4]/60 bg-[#3AFFD4]/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"}`}>
                <strong className="text-sm">{group.name}</strong>
                {group.description && <p className="mt-1 truncate text-xs text-neutral-500">{group.description}</p>}
              </button>)}
              {!groups.length && <p className="px-2 py-4 text-sm text-neutral-500">No groups yet. Create your first above.</p>}
            </div>
          </section>
        </div>
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          {!active ? <div className="py-14 text-center text-sm text-neutral-500">Select or create a group to assign members.</div> :
            <>
              <h2 className="font-bebas text-2xl tracking-wide">{active.name}</h2>
              <p className="mt-1 font-dm-mono text-xs text-[#3AFFD4]">{assignedCount.toLocaleString()} member{assignedCount===1?"":"s"} assigned</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block text-xs text-neutral-400">Rename group
                  <input className={`mt-1 ${field}`} value={editName} maxLength={100} onChange={e=>setEditName(e.target.value)}/>
                </label>
                <label className="block text-xs text-neutral-400">Description
                  <input className={`mt-1 ${field}`} value={editDescription} maxLength={1000} onChange={e=>setEditDescription(e.target.value)}/>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy || !editName.trim()} onClick={()=>void mutate({action:"update",id:active.id,name:editName,description:editDescription})} className="rounded-xl border border-[#3AFFD4]/40 px-4 py-2 text-xs text-[#3AFFD4]">Save group</button>
                <button type="button" disabled={busy} onClick={async ()=>{
                  if(!window.confirm(`Delete group "${active.name}"? Its member assignments will be removed, but the members and their DMs will remain.`)) return;
                  const result=await mutate({action:"delete",id:active.id});
                  if(result){setSelected("");setNotice("Group deleted; members and messages were preserved.");}
                }} className="rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-300">Delete group</button>
              </div>

              <h3 className="mt-8 font-dm-mono text-xs uppercase tracking-widest text-neutral-400">Assign members</h3>
              <form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();setPage(0);setSearch(searchTerm);}}>
                <input className={field} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search names"/>
                <button type="submit" className="rounded-xl border border-white/20 px-4 py-2 text-xs">Search</button>
              </form>
              <p className="mt-3 text-xs text-neutral-500">Tick a member to add them. Untick to remove them. Changes are saved immediately.</p>
              <div className="mt-3 max-h-[30rem] overflow-y-auto rounded-xl border border-white/10">
                {members.map(member => <label key={member.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 hover:bg-white/5">
                  <input type="checkbox" disabled={busy} checked={memberships.includes(member.id)}
                    onChange={e=>void assign(member.id,e.target.checked)}/>
                  <span className="min-w-0 truncate text-sm">{member.display_name || member.username || "Member"}
                    {member.username && <span className="ml-2 text-xs text-neutral-500">@{member.username}</span>}
                  </span>
                </label>)}
                {!members.length && <p className="p-5 text-sm text-neutral-500">No members match this search.</p>}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">Showing {members.length} of {total.toLocaleString()} matching members · Page {page+1}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy || page===0} onClick={()=>setPage(p=>p-1)} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">Previous</button>
                  <button type="button" disabled={busy || (page+1)*100>=total} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">Next</button>
                </div>
              </div>
            </>
          }
        </section>
      </div>
      {loading && <p className="mt-4 text-xs text-neutral-500">Loading…</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/25 p-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-[#39FF14]/25 p-3 text-sm text-[#39FF14]">{notice}</p>}
    </div>
  </main>;
}
