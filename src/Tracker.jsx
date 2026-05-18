import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Trash2,
  Download,
  ArrowLeft,
  Plus,
  X,
  AlertCircle,
  Tag,
  MapPin,
  Users,
  User,
  Save,
  Edit3,
  Library,
  Link2,
  ClipboardPaste,
  FileText,
} from "lucide-react";

const STORAGE_KEY = "al-naba-editorials";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function loadEditorials() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEditorials(editorials) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(editorials));
}

// ---------------------------------------------------------------------------
// JSON extraction from skill output
// ---------------------------------------------------------------------------

function extractJSONFromPaste(text) {
  if (!text || !text.trim()) {
    throw new Error("Nothing pasted");
  }

  // Try fenced JSON block first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  // Find first { and last } in the candidate
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found. Make sure you copied the JSON block from the skill output.");
  }

  let parsed;
  try {
    parsed = JSON.parse(candidate.slice(first, last + 1));
  } catch (e) {
    throw new Error(`JSON looks malformed: ${e.message}`);
  }

  // Normalise: ensure all expected fields exist
  return {
    issueNumber: parsed.issueNumber ?? null,
    publicationDate: parsed.publicationDate ?? "",
    title: parsed.title ?? "",
    summary: parsed.summary ?? "",
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    geographicFocus: Array.isArray(parsed.geographicFocus) ? parsed.geographicFocus : [],
    groupsMentioned: Array.isArray(parsed.groupsMentioned) ? parsed.groupsMentioned : [],
    individualsMentioned: Array.isArray(parsed.individualsMentioned) ? parsed.individualsMentioned : [],
    keyClaims: Array.isArray(parsed.keyClaims) ? parsed.keyClaims : [],
    significanceAssessment: parsed.significanceAssessment ?? "",
    confidence: parsed.confidence ?? "unknown",
    notes: parsed.notes ?? "",
    manualNotes: "",
  };
}

function emptyDraft() {
  return {
    issueNumber: null,
    publicationDate: "",
    title: "",
    summary: "",
    themes: [],
    geographicFocus: [],
    groupsMentioned: [],
    individualsMentioned: [],
    keyClaims: [],
    significanceAssessment: "",
    confidence: "unknown",
    notes: "",
    manualNotes: "",
  };
}

// ---------------------------------------------------------------------------
// Similarity scoring (Jaccard across tag fields)
// ---------------------------------------------------------------------------

function normaliseTag(t) {
  return (t || "").toString().trim().toLowerCase();
}

function similarityScore(a, b) {
  if (a.issueNumber === b.issueNumber) return -1;
  const buckets = ["themes", "geographicFocus", "groupsMentioned", "individualsMentioned"];
  let shared = 0;
  let total = 0;
  for (const k of buckets) {
    const sa = new Set((a[k] || []).map(normaliseTag));
    const sb = new Set((b[k] || []).map(normaliseTag));
    for (const v of sa) {
      total++;
      if (sb.has(v)) shared++;
    }
    for (const v of sb) {
      if (!sa.has(v)) total++;
    }
  }
  if (total === 0) return 0;
  return shared / total;
}

function findSimilar(target, all, limit = 4) {
  return all
    .map((e) => ({ editorial: e, score: similarityScore(target, e) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function aggregateTags(editorials, field) {
  const counts = {};
  for (const e of editorials) {
    for (const t of e[field] || []) {
      const n = normaliseTag(t);
      if (!n) continue;
      counts[n] = (counts[n] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function toCSV(editorials) {
  const headers = [
    "issueNumber",
    "publicationDate",
    "title",
    "summary",
    "themes",
    "geographicFocus",
    "groupsMentioned",
    "individualsMentioned",
    "keyClaims",
    "significanceAssessment",
    "manualNotes",
    "createdAt",
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = [headers.join(",")];
  for (const e of editorials) {
    rows.push(headers.map((h) => escape(e[h])).join(","));
  }
  return rows.join("\n");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Backup/restore from JSON
// ---------------------------------------------------------------------------

function exportBackup(editorials) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    editorials,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(payload, null, 2), `al-naba-backup-${date}.json`, "application/json");
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

  :root {
    --ink: #f1ead8;
    --ink-dim: #b3a98f;
    --ink-faint: #7a7058;
    --paper: #14130f;
    --paper-2: #1c1a14;
    --paper-3: #25221a;
    --rule: #2e2a1f;
    --ochre: #d4a14a;
    --ochre-dim: #8c6a30;
    --rust: #b6573a;
  }

  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    background: var(--paper);
    color: var(--ink);
    min-height: 100vh;
    line-height: 1.5;
  }
  * { box-sizing: border-box; }

  .display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
  .mono { font-family: 'IBM Plex Mono', monospace; }

  .anaba-dim { color: var(--ink-dim); }
  .anaba-faint { color: var(--ink-faint); }
  .anaba-ochre { color: var(--ochre); }
  .anaba-rust { color: var(--rust); }

  .anaba-button {
    font-family: 'IBM Plex Sans', sans-serif;
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--rule);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .anaba-button:hover { border-color: var(--ochre); color: var(--ochre); }
  .anaba-button:disabled { opacity: 0.4; cursor: not-allowed; }

  .anaba-button-primary {
    background: var(--ochre);
    color: var(--paper);
    border-color: var(--ochre);
    font-weight: 500;
  }
  .anaba-button-primary:hover { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .anaba-button-danger:hover { border-color: var(--rust); color: var(--rust); }

  .anaba-input {
    font-family: 'IBM Plex Sans', sans-serif;
    background: var(--paper-2);
    color: var(--ink);
    border: 1px solid var(--rule);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    width: 100%;
    outline: none;
  }
  .anaba-input:focus { border-color: var(--ochre); }

  .anaba-textarea {
    font-family: 'IBM Plex Sans', sans-serif;
    background: var(--paper-2);
    color: var(--ink);
    border: 1px solid var(--rule);
    padding: 0.75rem;
    font-size: 0.9rem;
    width: 100%;
    outline: none;
    resize: vertical;
    line-height: 1.55;
  }
  .anaba-textarea:focus { border-color: var(--ochre); }

  .anaba-textarea-mono {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.82rem;
  }

  .anaba-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.72rem;
    font-family: 'IBM Plex Mono', monospace;
    background: var(--paper-3);
    color: var(--ink-dim);
    border: 1px solid var(--rule);
    letter-spacing: 0.03em;
  }
  .anaba-pill-ochre {
    background: rgba(212, 161, 74, 0.08);
    color: var(--ochre);
    border-color: var(--ochre-dim);
  }
  .anaba-pill-rust {
    background: rgba(182, 87, 58, 0.08);
    color: var(--rust);
    border-color: var(--rust);
  }

  .anaba-card {
    background: var(--paper-2);
    border: 1px solid var(--rule);
    padding: 1.25rem;
    transition: border-color 0.15s ease;
  }
  .anaba-card:hover { border-color: var(--ochre-dim); }
  .anaba-card-clickable { cursor: pointer; }

  .anaba-masthead {
    border-bottom: 1px solid var(--rule);
    padding: 1.5rem 0 1rem 0;
  }
  .anaba-masthead-title {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 2rem;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }

  .anaba-section-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 0.5rem;
  }

  .anaba-divider {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 1.5rem 0;
  }

  .anaba-paste-zone {
    border: 1px dashed var(--rule);
    background: var(--paper-2);
    padding: 1rem;
    transition: all 0.15s ease;
  }
  .anaba-paste-zone:focus-within { border-color: var(--ochre); }

  .anaba-summary-prose {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 400;
    font-size: 1.025rem;
    line-height: 1.7;
    color: var(--ink);
  }

  .anaba-fade-in { animation: anaba-fade-in 0.3s ease; }
  @keyframes anaba-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  .anaba-grain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: 0.025;
    background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    mix-blend-mode: overlay;
    z-index: 1;
  }

  .anaba-tab-row {
    display: flex;
    gap: 0;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--rule);
  }
  .anaba-tab {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.6rem 1rem;
    color: var(--ink-faint);
    cursor: pointer;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .anaba-tab:hover { color: var(--ink-dim); }
  .anaba-tab.active { color: var(--ochre); border-bottom-color: var(--ochre); }
`;

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function Pill({ children, variant = "default", icon: Icon }) {
  const cls = variant === "ochre" ? "anaba-pill anaba-pill-ochre" : variant === "rust" ? "anaba-pill anaba-pill-rust" : "anaba-pill";
  return (
    <span className={cls}>
      {Icon && <Icon size={10} />}
      {children}
    </span>
  );
}

function SectionLabel({ children }) {
  return <div className="anaba-section-label">{children}</div>;
}

// ---------------------------------------------------------------------------
// Add view
// ---------------------------------------------------------------------------

function AddView({ onSave, onCancel, existing }) {
  const [mode, setMode] = useState("paste"); // paste | manual
  const [pasted, setPasted] = useState("");
  const [parseError, setParseError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const tryParse = () => {
    setParseError(null);
    try {
      const parsed = extractJSONFromPaste(pasted);
      setDraft(parsed);
    } catch (e) {
      setParseError(e.message);
    }
  };

  const startManual = () => {
    setDraft(emptyDraft());
    setMode("manual");
  };

  const updateDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const updateList = (field, value) => {
    const items = value.split(",").map((s) => s.trim()).filter(Boolean);
    updateDraft({ [field]: items });
  };

  const handleSave = () => {
    setSaveError(null);
    if (!draft.issueNumber) {
      setSaveError("Issue number is required to save");
      return;
    }
    if (existing[draft.issueNumber]) {
      const ok = window.confirm(`Issue ${draft.issueNumber} already exists. Overwrite?`);
      if (!ok) return;
    }
    onSave(draft);
  };

  // Initial picker (no draft yet)
  if (!draft) {
    return (
      <div className="anaba-fade-in">
        <div className="anaba-tab-row">
          <button className={`anaba-tab ${mode === "paste" ? "active" : ""}`} onClick={() => setMode("paste")}>
            Paste from skill
          </button>
          <button className={`anaba-tab ${mode === "manual" ? "active" : ""}`} onClick={startManual}>
            Manual entry
          </button>
        </div>

        {mode === "paste" && (
          <div>
            <SectionLabel>Paste the skill output</SectionLabel>
            <div className="anaba-dim" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              In Claude, drop a screenshot of an al-Naba editorial. The al-naba-analyser skill produces a JSON block. Copy the whole response, or just the JSON, and paste it here.
            </div>
            <div className="anaba-paste-zone">
              <textarea
                className="anaba-textarea anaba-textarea-mono"
                rows={10}
                placeholder='Paste the full skill output (narrative + ```json ... ``` block) or just the JSON object.'
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                style={{ border: "none", background: "transparent", padding: 0 }}
              />
            </div>
            {parseError && (
              <div className="anaba-rust" style={{ fontSize: "0.85rem", marginTop: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <AlertCircle size={14} /> {parseError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="anaba-button anaba-button-primary" onClick={tryParse} disabled={!pasted.trim()}>
                <ClipboardPaste size={14} /> Parse and review
              </button>
              <button className="anaba-button" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Review and edit
  return (
    <div className="anaba-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
        <div>
          <SectionLabel>Review and confirm</SectionLabel>
          <div className="anaba-dim" style={{ fontSize: "0.85rem" }}>
            Adjust any field before saving. List fields are comma-separated. Key claims are semicolon-separated.
          </div>
        </div>
        {draft.confidence && draft.confidence !== "unknown" && (
          <Pill variant={draft.confidence === "high" ? "ochre" : draft.confidence === "low" ? "rust" : "default"}>
            confidence: {draft.confidence}
          </Pill>
        )}
      </div>

      {saveError && (
        <div className="anaba-card" style={{ borderColor: "var(--rust)", marginBottom: "1rem" }}>
          <div className="anaba-rust" style={{ fontSize: "0.85rem" }}>{saveError}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <SectionLabel>Issue number *</SectionLabel>
          <input className="anaba-input mono" type="number" value={draft.issueNumber ?? ""} onChange={(e) => updateDraft({ issueNumber: parseInt(e.target.value) || null })} />
        </div>
        <div>
          <SectionLabel>Publication date</SectionLabel>
          <input className="anaba-input mono" type="date" value={draft.publicationDate || ""} onChange={(e) => updateDraft({ publicationDate: e.target.value })} />
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SectionLabel>Title</SectionLabel>
        <input className="anaba-input display" style={{ fontSize: "1.05rem" }} value={draft.title || ""} onChange={(e) => updateDraft({ title: e.target.value })} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SectionLabel>Analytical summary</SectionLabel>
        <textarea className="anaba-textarea" rows={8} value={draft.summary || ""} onChange={(e) => updateDraft({ summary: e.target.value })} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SectionLabel>Themes (comma separated)</SectionLabel>
        <input className="anaba-input mono" value={(draft.themes || []).join(", ")} onChange={(e) => updateList("themes", e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <SectionLabel>Geographic focus</SectionLabel>
          <input className="anaba-input mono" value={(draft.geographicFocus || []).join(", ")} onChange={(e) => updateList("geographicFocus", e.target.value)} />
        </div>
        <div>
          <SectionLabel>Groups mentioned</SectionLabel>
          <input className="anaba-input mono" value={(draft.groupsMentioned || []).join(", ")} onChange={(e) => updateList("groupsMentioned", e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SectionLabel>Individuals mentioned</SectionLabel>
        <input className="anaba-input mono" value={(draft.individualsMentioned || []).join(", ")} onChange={(e) => updateList("individualsMentioned", e.target.value)} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SectionLabel>Key claims (semicolon separated)</SectionLabel>
        <textarea className="anaba-textarea" rows={3} value={(draft.keyClaims || []).join("; ")} onChange={(e) => updateDraft({ keyClaims: e.target.value.split(";").map((s) => s.trim()).filter(Boolean) })} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SectionLabel>Significance assessment</SectionLabel>
        <textarea className="anaba-textarea" rows={3} value={draft.significanceAssessment || ""} onChange={(e) => updateDraft({ significanceAssessment: e.target.value })} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <SectionLabel>Analyst notes (optional)</SectionLabel>
        <textarea className="anaba-textarea" rows={2} placeholder="Add any analyst observations or context" value={draft.manualNotes || ""} onChange={(e) => updateDraft({ manualNotes: e.target.value })} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="anaba-button anaba-button-primary" onClick={handleSave}>
          <Save size={14} /> Save to tracker
        </button>
        <button className="anaba-button" onClick={() => setDraft(null)}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="anaba-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------

function TagBlock({ title, items, icon: Icon, variant }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {items.map((t, i) => <Pill key={i} variant={variant} icon={Icon}>{t}</Pill>)}
      </div>
    </div>
  );
}

function SharedTags({ a, b }) {
  const shared = [];
  for (const field of ["themes", "geographicFocus", "groupsMentioned", "individualsMentioned"]) {
    const sa = new Set((a[field] || []).map(normaliseTag));
    for (const t of b[field] || []) {
      if (sa.has(normaliseTag(t))) shared.push(t);
    }
  }
  if (shared.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
      {shared.slice(0, 6).map((t, i) => <Pill key={i} variant="ochre">{t}</Pill>)}
    </div>
  );
}

function DetailView({ editorial, allEditorials, onBack, onDelete, onUpdate, onSelect }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(editorial.manualNotes || "");
  const similar = useMemo(() => findSimilar(editorial, allEditorials), [editorial, allEditorials]);

  useEffect(() => {
    setNotesDraft(editorial.manualNotes || "");
    setEditingNotes(false);
  }, [editorial.issueNumber]);

  const saveNotes = () => {
    onUpdate({ ...editorial, manualNotes: notesDraft });
    setEditingNotes(false);
  };

  return (
    <div className="anaba-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <button className="anaba-button" onClick={onBack}><ArrowLeft size={14} /> Library</button>
        <button className="anaba-button anaba-button-danger" onClick={() => {
          if (window.confirm(`Delete issue ${editorial.issueNumber}? This cannot be undone.`)) {
            onDelete(editorial.issueNumber);
          }
        }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span className="mono anaba-ochre" style={{ fontSize: "0.875rem", letterSpacing: "0.05em" }}>ISSUE {editorial.issueNumber}</span>
        {editorial.publicationDate && (
          <span className="mono anaba-faint" style={{ fontSize: "0.8rem" }}>· {editorial.publicationDate}</span>
        )}
      </div>

      <h1 className="display" style={{ fontSize: "2rem", fontWeight: 500, lineHeight: 1.15, marginBottom: "1.5rem", marginTop: 0 }}>
        {editorial.title}
      </h1>

      <hr className="anaba-divider" />

      <SectionLabel>Summary</SectionLabel>
      <div className="anaba-summary-prose" style={{ marginBottom: "2rem", whiteSpace: "pre-wrap" }}>{editorial.summary}</div>

      {editorial.significanceAssessment && (
        <>
          <SectionLabel>Significance</SectionLabel>
          <div className="anaba-summary-prose" style={{ marginBottom: "2rem", fontStyle: "italic", color: "var(--ink-dim)" }}>
            {editorial.significanceAssessment}
          </div>
        </>
      )}

      {editorial.keyClaims?.length > 0 && (
        <>
          <SectionLabel>Key claims</SectionLabel>
          <ul style={{ margin: "0 0 2rem 0", padding: 0, listStyle: "none" }}>
            {editorial.keyClaims.map((c, i) => (
              <li key={i} style={{ borderLeft: "2px solid var(--ochre-dim)", paddingLeft: "0.75rem", marginBottom: "0.5rem", fontSize: "0.95rem" }}>{c}</li>
            ))}
          </ul>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        <TagBlock title="Themes" items={editorial.themes} icon={Tag} variant="ochre" />
        <TagBlock title="Geographic focus" items={editorial.geographicFocus} icon={MapPin} />
        <TagBlock title="Groups" items={editorial.groupsMentioned} icon={Users} />
        <TagBlock title="Individuals" items={editorial.individualsMentioned} icon={User} />
      </div>

      <hr className="anaba-divider" />

      <SectionLabel>Analyst notes</SectionLabel>
      {editingNotes ? (
        <div>
          <textarea className="anaba-textarea" rows={4} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} />
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
            <button className="anaba-button anaba-button-primary" onClick={saveNotes}><Save size={14} /> Save</button>
            <button className="anaba-button" onClick={() => { setNotesDraft(editorial.manualNotes || ""); setEditingNotes(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "2rem" }}>
          <div className="anaba-dim" style={{ fontSize: "0.95rem", fontStyle: editorial.manualNotes ? "normal" : "italic", flex: 1, whiteSpace: "pre-wrap" }}>
            {editorial.manualNotes || "No notes added."}
          </div>
          <button className="anaba-button" onClick={() => setEditingNotes(true)}><Edit3 size={14} /> Edit</button>
        </div>
      )}

      {similar.length > 0 && (
        <>
          <hr className="anaba-divider" />
          <SectionLabel>Related editorials</SectionLabel>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {similar.map(({ editorial: e, score }) => (
              <div key={e.issueNumber} className="anaba-card anaba-card-clickable" onClick={() => onSelect(e.issueNumber)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                  <span className="mono anaba-ochre" style={{ fontSize: "0.8rem" }}>
                    <Link2 size={11} style={{ display: "inline", marginRight: "0.3rem", verticalAlign: "middle" }} />
                    ISSUE {e.issueNumber}
                  </span>
                  <span className="mono anaba-faint" style={{ fontSize: "0.7rem" }}>overlap {Math.round(score * 100)}%</span>
                </div>
                <div className="display" style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>{e.title}</div>
                <SharedTags a={editorial} b={e} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Library view
// ---------------------------------------------------------------------------

function LibraryView({ editorials, onSelect, onAdd, onExportCSV, onExportBackup, onImportBackup, filter, setFilter, tagFilter, setTagFilter }) {
  const sorted = useMemo(() => [...editorials].sort((a, b) => (b.issueNumber || 0) - (a.issueNumber || 0)), [editorials]);
  const fileInputRef = useRef(null);

  const filtered = useMemo(() => {
    let result = sorted;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((e) => {
        return (
          String(e.issueNumber).includes(q) ||
          (e.title || "").toLowerCase().includes(q) ||
          (e.summary || "").toLowerCase().includes(q) ||
          (e.manualNotes || "").toLowerCase().includes(q)
        );
      });
    }
    if (tagFilter) {
      const tf = normaliseTag(tagFilter);
      result = result.filter((e) => {
        const all = [...(e.themes || []), ...(e.geographicFocus || []), ...(e.groupsMentioned || []), ...(e.individualsMentioned || [])];
        return all.some((t) => normaliseTag(t) === tf);
      });
    }
    return result;
  }, [sorted, filter, tagFilter]);

  const topThemes = useMemo(() => aggregateTags(editorials, "themes").slice(0, 8), [editorials]);
  const topGeo = useMemo(() => aggregateTags(editorials, "geographicFocus").slice(0, 6), [editorials]);

  return (
    <div className="anaba-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <SectionLabel>Library</SectionLabel>
          <div className="anaba-dim" style={{ fontSize: "0.85rem" }}>
            {editorials.length} editorial{editorials.length === 1 ? "" : "s"} tracked
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="anaba-button" onClick={() => fileInputRef.current?.click()}>
            <FileText size={14} /> Import backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportBackup(f);
              e.target.value = "";
            }}
          />
          <button className="anaba-button" onClick={onExportBackup} disabled={editorials.length === 0}>
            <Download size={14} /> Backup
          </button>
          <button className="anaba-button" onClick={onExportCSV} disabled={editorials.length === 0}>
            <Download size={14} /> CSV
          </button>
          <button className="anaba-button anaba-button-primary" onClick={onAdd}>
            <Plus size={14} /> Add editorial
          </button>
        </div>
      </div>

      {editorials.length > 0 && (
        <div style={{ marginBottom: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <SectionLabel>Top themes</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
              {topThemes.map(([t, c]) => (
                <span key={t} className={tagFilter && normaliseTag(tagFilter) === t ? "anaba-pill anaba-pill-ochre" : "anaba-pill"} style={{ cursor: "pointer" }} onClick={() => setTagFilter(tagFilter === t ? "" : t)}>
                  {t} <span className="anaba-faint">{c}</span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Top geography</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
              {topGeo.map(([t, c]) => (
                <span key={t} className={tagFilter && normaliseTag(tagFilter) === t ? "anaba-pill anaba-pill-ochre" : "anaba-pill"} style={{ cursor: "pointer" }} onClick={() => setTagFilter(tagFilter === t ? "" : t)}>
                  {t} <span className="anaba-faint">{c}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {editorials.length > 0 && (
        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)" }} />
            <input className="anaba-input" style={{ paddingLeft: "2rem" }} placeholder="Search issue, title, summary, notes" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {tagFilter && (
            <button className="anaba-button" onClick={() => setTagFilter("")}>
              <X size={14} /> Tag: {tagFilter}
            </button>
          )}
        </div>
      )}

      {editorials.length === 0 ? (
        <div className="anaba-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <Library size={28} className="anaba-faint" style={{ margin: "0 auto 1rem", display: "block" }} />
          <div className="display" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>The library is empty</div>
          <div className="anaba-dim" style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            Add an editorial by pasting the output of the al-naba-analyser skill.
          </div>
          <button className="anaba-button anaba-button-primary" onClick={onAdd}>
            <Plus size={14} /> Add the first one
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="anaba-dim" style={{ fontStyle: "italic", padding: "1rem 0" }}>No editorials match the current filter.</div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filtered.map((e) => (
            <div key={e.issueNumber} className="anaba-card anaba-card-clickable" onClick={() => onSelect(e.issueNumber)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <span className="mono anaba-ochre" style={{ fontSize: "0.8rem", letterSpacing: "0.05em" }}>ISSUE {e.issueNumber}</span>
                <span className="mono anaba-faint" style={{ fontSize: "0.7rem" }}>{e.publicationDate || "no date"}</span>
              </div>
              <div className="display" style={{ fontSize: "1.15rem", marginBottom: "0.5rem", fontWeight: 500 }}>{e.title}</div>
              <div className="anaba-dim" style={{ fontSize: "0.9rem", marginBottom: "0.75rem", lineHeight: 1.5, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
                {e.summary}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {(e.themes || []).slice(0, 4).map((t, i) => <Pill key={`t${i}`} variant="ochre" icon={Tag}>{t}</Pill>)}
                {(e.geographicFocus || []).slice(0, 3).map((t, i) => <Pill key={`g${i}`} icon={MapPin}>{t}</Pill>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function Tracker() {
  const [editorials, setEditorials] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [filter, setFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => {
    setEditorials(loadEditorials());
    setLoaded(true);
  }, []);

  const editorialList = useMemo(() => Object.values(editorials), [editorials]);

  const handleSave = (draft) => {
    const entry = {
      ...draft,
      createdAt: editorials[draft.issueNumber]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = { ...editorials, [draft.issueNumber]: entry };
    setEditorials(next);
    saveEditorials(next);
    setSelectedIssue(draft.issueNumber);
    setView("detail");
  };

  const handleUpdate = (entry) => {
    const next = { ...editorials, [entry.issueNumber]: { ...entry, updatedAt: new Date().toISOString() } };
    setEditorials(next);
    saveEditorials(next);
  };

  const handleDelete = (issueNumber) => {
    const next = { ...editorials };
    delete next[issueNumber];
    setEditorials(next);
    saveEditorials(next);
    setView("library");
    setSelectedIssue(null);
  };

  const handleExportCSV = () => {
    const csv = toCSV(editorialList);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `al-naba-tracker-${date}.csv`, "text/csv;charset=utf-8");
  };

  const handleExportBackup = () => exportBackup(editorials);

  const handleImportBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = data.editorials || data;
        if (typeof incoming !== "object") throw new Error("Backup file does not contain an editorials object");
        const merged = { ...editorials };
        let added = 0;
        let overwritten = 0;
        for (const [k, v] of Object.entries(incoming)) {
          if (merged[k]) overwritten++;
          else added++;
          merged[k] = v;
        }
        const ok = window.confirm(`Import ${added} new and overwrite ${overwritten} existing entries?`);
        if (!ok) return;
        setEditorials(merged);
        saveEditorials(merged);
      } catch (e) {
        window.alert(`Could not import: ${e.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="anaba-grain" />
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "2rem 1.5rem 5rem", position: "relative", zIndex: 2 }}>
        <div className="anaba-masthead">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div className="mono anaba-faint" style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                Analytical tracker
              </div>
              <div className="anaba-masthead-title display">al-Nabaʾ editorials</div>
            </div>
            <div className="mono anaba-faint" style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}>
              data stored locally in your browser
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          {!loaded ? (
            <div className="anaba-dim" style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
          ) : view === "add" ? (
            <AddView existing={editorials} onSave={handleSave} onCancel={() => setView("library")} />
          ) : view === "detail" && editorials[selectedIssue] ? (
            <DetailView
              editorial={editorials[selectedIssue]}
              allEditorials={editorialList}
              onBack={() => setView("library")}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onSelect={(n) => { setSelectedIssue(n); window.scrollTo(0, 0); }}
            />
          ) : (
            <LibraryView
              editorials={editorialList}
              onSelect={(n) => { setSelectedIssue(n); setView("detail"); window.scrollTo(0, 0); }}
              onAdd={() => setView("add")}
              onExportCSV={handleExportCSV}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              filter={filter}
              setFilter={setFilter}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
            />
          )}
        </div>
      </div>
    </>
  );
}
