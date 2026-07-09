import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, FolderClosed, Search as SearchIcon, Rocket, Puzzle, Settings as SettingsIcon,
  LogOut, Plus, Sparkles, Copy, Trash2, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProgressStages from "@/components/ProgressStages";
import ConnectExtension from "@/components/ConnectExtension";

const spring = { type: "spring", stiffness: 130, damping: 18 };
const NAV = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "folders", label: "Folders", icon: FolderClosed },
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "deployments", label: "Deploy History", icon: Rocket },
  { id: "connect", label: "Connect Extension", icon: Puzzle },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("recent");
  const [folders, setFolders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [deployCtx, setDeployCtx] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);

  const load = useCallback(async () => {
    try {
      const [f, r, d] = await Promise.all([
        api.get("/folders"), api.get("/recent"), api.get("/deployments"),
      ]);
      setFolders(f.data);
      setRecent(r.data.recent);
      setDeployments(d.data.deployments);
    } catch { toast.error("Could not load your memories"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runDeploy = async (folder_id, name) => {
    try {
      const res = await api.post("/memory/deploy", { folder_id });
      setDeployCtx({ context: res.data.context, name, count: res.data.memory_count });
      await navigator.clipboard.writeText(res.data.context).catch(() => {});
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Nothing to deploy yet");
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 glass border-r sticky top-0 h-screen p-5 flex flex-col" data-testid="sidebar">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 rounded-[11px] bg-[var(--ink)] flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-white memory-glow" />
          </div>
          <span className="font-semibold tracking-tight">Bounce</span>
        </div>

        <button data-testid="new-memory-btn" onClick={() => setSaveOpen(true)}
                className="btn-primary focus-ring w-full h-11 flex items-center justify-center gap-2 text-sm font-medium mb-6">
          <Plus className="w-4 h-4" /> New memory
        </button>

        <nav className="space-y-1 flex-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} data-testid={`nav-${n.id}`} onClick={() => { setTab(n.id); setActiveFolder(null); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition-all duration-200 ${active ? "bg-white shadow-sm text-[var(--ink)]" : "text-[#6b7280] hover:bg-white/60"}`}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={2} /> {n.label}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-[var(--border)] flex items-center gap-3 px-1">
          {user?.picture
            ? <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
            : <div className="w-8 h-8 rounded-full bg-[var(--glow)] text-[var(--accent)] text-xs font-semibold flex items-center justify-center">{(user?.name || user?.email || "U")[0].toUpperCase()}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "You"}</p>
            <p className="text-xs text-[#9ca3af] truncate">{user?.email}</p>
          </div>
          <button data-testid="logout-btn" onClick={logout} className="p-2 rounded-lg hover:bg-white/70 transition-colors">
            <LogOut className="w-4 h-4 text-[#6b7280]" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 px-10 py-10 overflow-y-auto h-screen">
        <AnimatePresence mode="wait">
          <motion.div key={tab + (activeFolder || "")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }} transition={spring}>
            {tab === "recent" && <RecentView recent={recent} folders={folders} onDeploy={runDeploy} onChanged={load} />}
            {tab === "folders" && <FoldersView folders={folders} recent={recent} onDeploy={runDeploy} onCreate={load} />}
            {tab === "search" && <SearchView folders={folders} />}
            {tab === "deployments" && <DeploymentsView deployments={deployments} folders={folders} />}
            {tab === "connect" && <ConnectExtension />}
            {tab === "settings" && <SettingsView user={user} logout={logout} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {saveOpen && <SavePanel folders={folders} onClose={() => setSaveOpen(false)} onSaved={load} />}
      </AnimatePresence>
      <AnimatePresence>
        {deployCtx && <DeployModal data={deployCtx} onClose={() => setDeployCtx(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Section header ---------- */
const Header = ({ title, subtitle, right }) => (
  <div className="flex items-end justify-between mb-8">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-[#6b7280] mt-1">{subtitle}</p>}
    </div>
    {right}
  </div>
);

/* ---------- Memory card ---------- */
function MemoryCard({ m, folderName, onDeploy, onDelete }) {
  const s = m.structured || {};
  const chips = (s.technologies || []).slice(0, 4);
  return (
    <motion.div whileHover={{ scale: 1.01 }} transition={spring}
                className="card-surface p-5 group" data-testid="memory-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium tracking-tight truncate">{m.title || "Untitled"}</h3>
          {folderName && <span className="text-xs text-[var(--accent)] font-medium">{folderName}</span>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDeploy && (
            <button data-testid="card-deploy-btn" onClick={() => onDeploy(m.folder_id, folderName)}
                    className="p-2 rounded-lg hover:bg-[var(--glow)] text-[var(--accent)] transition-colors" title="Deploy">
              <Rocket className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button data-testid="card-delete-btn" onClick={() => onDelete(m.memory_id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-[#9ca3af] hover:text-red-500 transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {s.summary && <p className="text-sm text-[#6b7280] mt-2 leading-relaxed line-clamp-2">{s.summary}</p>}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {chips.map((c, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[#F3F4F6] text-[#4b5563]">{c}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ---------- Recent ---------- */
function RecentView({ recent, onDeploy, onChanged }) {
  const del = async (id) => {
    try { await api.delete(`/memory/${id}`); toast.success("Memory deleted"); onChanged(); }
    catch { toast.error("Could not delete"); }
  };
  return (
    <div>
      <Header title="Recent" subtitle="Your latest saved memories across every AI." />
      {recent.length === 0 ? <Empty label="No memories yet. Save your first conversation." /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recent.map((m) => <MemoryCard key={m.memory_id} m={m} folderName={m.folder_name} onDeploy={onDeploy} onDelete={del} />)}
        </div>
      )}
    </div>
  );
}

/* ---------- Folders ---------- */
function FoldersView({ folders, recent, onDeploy, onCreate }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);

  const create = async () => {
    if (!name.trim()) return;
    try { await api.post("/folders", { name: name.trim() }); setName(""); toast.success("Folder created"); onCreate(); }
    catch { toast.error("Could not create folder"); }
  };

  if (open) {
    const items = recent.filter((m) => m.folder_id === open.folder_id);
    return (
      <div>
        <Header title={open.name} subtitle={`${open.memory_count} memories`}
          right={<div className="flex gap-2">
            <button data-testid="folder-back-btn" onClick={() => setOpen(null)} className="btn-ghost focus-ring px-4 py-2 text-sm font-medium">Back</button>
            <button data-testid="folder-deploy-btn" onClick={() => onDeploy(open.folder_id, open.name)} className="btn-primary focus-ring px-4 py-2 text-sm font-medium flex items-center gap-2"><Rocket className="w-4 h-4" /> Deploy</button>
          </div>} />
        {items.length === 0 ? <Empty label="No memories in this folder yet." /> : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((m) => <MemoryCard key={m.memory_id} m={m} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Header title="Folders" subtitle="Organize memory by project or context."
        right={
          <div className="flex items-center gap-2">
            <input data-testid="new-folder-input" value={name} onChange={(e) => setName(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New folder"
                   className="h-10 px-4 rounded-full border border-[var(--border)] bg-white text-sm focus-ring w-40" />
            <button data-testid="create-folder-btn" onClick={create} className="btn-primary focus-ring px-4 py-2 text-sm font-medium">Create</button>
          </div>
        } />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((f) => (
          <motion.button key={f.folder_id} data-testid="folder-card" whileHover={{ scale: 1.01 }} transition={spring}
                         onClick={() => setOpen(f)} className="card-surface p-5 text-left group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-[12px] bg-[var(--glow)] flex items-center justify-center">
                <FolderClosed className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <span className="text-sm text-[#9ca3af]">{f.memory_count}</span>
            </div>
            <h3 className="font-medium tracking-tight mt-4">{f.name}</h3>
            <p className="text-xs text-[#9ca3af] mt-0.5">{f.memory_count} {f.memory_count === 1 ? "memory" : "memories"}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Search ---------- */
function SearchView({ folders }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const names = useMemo(() => Object.fromEntries(folders.map((f) => [f.folder_id, f.name])), [folders]);

  const run = async () => {
    if (!q.trim()) return;
    try {
      const res = await api.post("/memory/search", { query: q });
      setResults(res.data.results); setSearched(true);
    } catch { toast.error("Search failed"); }
  };

  return (
    <div>
      <Header title="Search" subtitle="Find any memory in milliseconds." />
      <div className="relative max-w-xl mb-8">
        <SearchIcon className="w-4 h-4 text-[#9ca3af] absolute left-4 top-1/2 -translate-y-1/2" />
        <input data-testid="search-input" value={q} onChange={(e) => setQ(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Search memories, decisions, technologies…"
               className="w-full h-12 pl-11 pr-4 rounded-[14px] border border-[var(--border)] bg-white text-sm focus-ring" />
      </div>
      {searched && results.length === 0 && <Empty label="No matches found." />}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {results.map((m) => <MemoryCard key={m.memory_id} m={m} folderName={names[m.folder_id]} />)}
      </div>
    </div>
  );
}

/* ---------- Deployments ---------- */
function DeploymentsView({ deployments, folders }) {
  const names = useMemo(() => Object.fromEntries(folders.map((f) => [f.folder_id, f.name])), [folders]);
  return (
    <div>
      <Header title="Deploy History" subtitle="Every context you've carried into an AI." />
      {deployments.length === 0 ? <Empty label="No deployments yet." /> : (
        <div className="space-y-3 max-w-3xl">
          {deployments.map((d) => (
            <div key={d.deployment_id} className="card-surface p-5 flex items-center justify-between" data-testid="deployment-row">
              <div>
                <p className="font-medium tracking-tight">{names[d.folder_id] || "Folder"}</p>
                <p className="text-xs text-[#9ca3af] mt-0.5">{d.memory_ids?.length || 0} memories · {new Date(d.created_at).toLocaleString()}</p>
              </div>
              <button className="btn-ghost focus-ring px-3 py-2 text-xs font-medium flex items-center gap-1.5"
                      onClick={() => { navigator.clipboard.writeText(d.context); toast.success("Context copied"); }}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsView({ user, logout }) {
  const [history, setHistory] = useState(false);
  return (
    <div className="max-w-2xl">
      <Header title="Settings" />
      <div className="card-surface divide-y divide-[var(--border)]">
        <Row label="Name" value={user?.name} />
        <Row label="Email" value={user?.email} />
        <Row label="Provider" value={user?.provider} />
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Keep conversation history</p>
            <p className="text-xs text-[#9ca3af] mt-0.5">When off, raw chats are deleted after processing. Only memory is kept.</p>
          </div>
          <button data-testid="history-toggle" onClick={() => setHistory((v) => !v)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${history ? "bg-[var(--accent)]" : "bg-[#E5E7EB]"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${history ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </div>
      <button data-testid="settings-logout-btn" onClick={logout}
              className="mt-6 btn-ghost focus-ring px-4 py-2.5 text-sm font-medium text-red-500 flex items-center gap-2">
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}
const Row = ({ label, value }) => (
  <div className="p-5 flex items-center justify-between">
    <span className="text-sm text-[#6b7280]">{label}</span>
    <span className="text-sm font-medium capitalize">{value || "—"}</span>
  </div>
);

const Empty = ({ label }) => (
  <div className="card-surface p-12 flex flex-col items-center text-center" data-testid="empty-state">
    <div className="w-12 h-12 rounded-full bg-[var(--glow)] flex items-center justify-center mb-4">
      <Sparkles className="w-5 h-5 text-[var(--accent)]" />
    </div>
    <p className="text-sm text-[#6b7280]">{label}</p>
  </div>
);

/* ---------- Save Panel ---------- */
function SavePanel({ folders, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [folderId, setFolderId] = useState(folders[0]?.folder_id || "");
  const [newFolder, setNewFolder] = useState("");
  const [asNew, setAsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState(null);

  const optimize = async () => {
    if (!text.trim()) return;
    setOptimizing(true);
    try {
      const res = await api.post("/optimize", { prompt: text });
      setText(res.data.optimized); toast.success("Prompt optimized");
    } catch { toast.error("Optimize failed"); } finally { setOptimizing(false); }
  };

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true); setDone(false);
    const payload = { conversation: text };
    if (asNew && newFolder.trim()) payload.folder_name = newFolder.trim();
    else payload.folder_id = folderId;
    try {
      const res = await api.post("/memory/save", payload);
      setDone(true);
      setTimeout(() => { setResult(res.data.memory); onSaved(); }, 650);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed"); setSaving(false);
    }
  };

  const s = result?.structured || {};

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={spring}
                  className="fixed right-0 top-0 h-screen w-full max-w-[520px] bg-white z-50 shadow-2xl flex flex-col" data-testid="save-panel">
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">New memory</h2>
            <p className="text-sm text-[#6b7280]">Paste a conversation. Bounce distills it.</p>
          </div>
          <button data-testid="save-panel-close" onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!result ? (
            <>
              <textarea data-testid="conversation-input" value={text} onChange={(e) => setText(e.target.value)}
                        placeholder="Paste your AI conversation here…" rows={10}
                        className="w-full rounded-[14px] border border-[var(--border)] bg-white p-4 text-sm focus-ring resize-none leading-relaxed" />

              <button data-testid="optimize-btn" onClick={optimize} disabled={optimizing || !text.trim()}
                      className="btn-ghost focus-ring px-4 py-2 text-sm font-medium flex items-center gap-2 border border-[var(--border)] disabled:opacity-40">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" /> {optimizing ? "Optimizing…" : "Optimize Prompt"}
              </button>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" data-testid="save-as-new-checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} className="accent-[var(--accent)]" />
                  Save as new folder
                </label>
                {asNew ? (
                  <input data-testid="new-folder-name-input" value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                         placeholder="Folder name" className="w-full h-11 px-4 rounded-[14px] border border-[var(--border)] text-sm focus-ring" />
                ) : (
                  <select data-testid="folder-select" value={folderId} onChange={(e) => setFolderId(e.target.value)}
                          className="w-full h-11 px-4 rounded-[14px] border border-[var(--border)] bg-white text-sm focus-ring">
                    {folders.map((f) => <option key={f.folder_id} value={f.folder_id}>{f.name}</option>)}
                  </select>
                )}
              </div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-4" data-testid="save-result">
              <div className="flex items-center gap-2 text-[var(--success)]">
                <span className="w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /></span>
                <span className="text-sm font-medium">Memory Ready</span>
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{result.title}</h3>
              {s.summary && <p className="text-sm text-[#6b7280] leading-relaxed">{s.summary}</p>}
              <StructuredBlock label="Decisions" items={s.decisions} />
              <StructuredBlock label="Next Tasks" items={s.todos} />
              <StructuredBlock label="Technologies" items={s.technologies} />
              <StructuredBlock label="Constraints" items={s.constraints} />
            </motion.div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--border)] flex items-center justify-between">
          {saving && !result ? <ProgressStages done={done} /> : <span />}
          {!result ? (
            <button data-testid="save-memory-btn" onClick={save} disabled={saving || !text.trim()}
                    className="btn-primary focus-ring px-6 py-3 text-sm font-medium disabled:opacity-40">Save memory</button>
          ) : (
            <button data-testid="save-done-btn" onClick={onClose} className="btn-primary focus-ring px-6 py-3 text-sm font-medium">Done</button>
          )}
        </div>
      </motion.div>
    </>
  );
}

const StructuredBlock = ({ label, items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af] mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className="text-sm text-[#374151] flex gap-2"><span className="text-[var(--accent)]">·</span>{it}</li>)}
      </ul>
    </div>
  );
};

/* ---------- Deploy modal ---------- */
function DeployModal({ data, onClose }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  transition={spring} className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div className="card-surface w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto memory-glow" data-testid="deploy-modal">
          <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Memory deployed</h2>
                <p className="text-sm text-[#6b7280]">{data.name} · {data.count} memories · copied to clipboard</p>
              </div>
            </div>
            <button data-testid="deploy-close-btn" onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5" /></button>
          </div>
          <pre className="flex-1 overflow-auto p-6 text-xs text-[#374151] whitespace-pre-wrap font-mono leading-relaxed" data-testid="deploy-context">{data.context}</pre>
          <div className="p-4 border-t border-[var(--border)] flex justify-end">
            <button onClick={() => { navigator.clipboard.writeText(data.context); toast.success("Copied"); }}
                    className="btn-primary focus-ring px-5 py-2.5 text-sm font-medium flex items-center gap-2"><Copy className="w-4 h-4" /> Copy again</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
