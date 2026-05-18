import React, { useState, useMemo, useEffect } from "react";
import {
  Search, Trash2, Download, ArrowLeft, Plus, X, AlertCircle,
  Tag, MapPin, Users, User, Edit3, Library, Link2,
  ClipboardPaste, ExternalLink, Github,
} from "lucide-react";

// Bundle every editorial JSON file in data/editorials at build time.
// Vite resolves the glob; the user adds files by committing them to that folder.
const editorialModules = import.meta.glob("../data/editorials/*.json", { eager: true });

const ALL_EDITORIALS = (() => {
  const result = {};
  for (const [path, mod] of Object.entries(editorialModules)) {
    const data = mod.default || mod;
    if (data && data.issueNumber != null) {
      result[data.issueNumber] = normalise(data);
    }
  }
  return result;
})();

function normalise(e) {
  return {
    issueNumber: e.issueNumber,
    publicationDate: e.publicationDate || "",
    title: e.title || "",
    summary: e.summary || "",
    themes: Array.isArray(e.themes) ? e.themes : [],
    geographicFocus: Array.isArray(e.geographicFocus) ? e.geographicFocus : [],
    groupsMentioned: Array.isArray(e.groupsMentioned) ? e.groupsMentioned : [],
    individualsMentioned: Array.isArray(e.individualsMentioned) ? e.individualsMentioned : [],
    keyClaims: Array.isArray(e.keyClaims) ? e.keyClaims : [],
    significanceAssessment: e.significanceAssessment || "",
    confidence: e.confidence || "",
    notes: e.notes || "",
    manualNotes: e.manualNotes || "",
  };
}

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || "";

function githubNewFileURL(draft) {
  if (!GITHUB_REPO) return null;
  const content = JSON.stringify(draft, null, 2);
  const filename = `${draft.issueNumber}.json`;
  return `https://github.com/${GITHUB_REPO}/new/main/data/editorials?filename=${encodeURIComponent(filename)}&value=${encodeURIComponent(content)}`;
}

function githubEditFileURL(issueNumber) {
  if (!GITHUB_REPO) return null;
  return `https://github.com/${GITHUB_REPO}/edit/main/data/editorials/${issueNumber}.json`;
}

function githubViewFileURL(issueNumber) {
  if (!GITHUB_REPO) return null;
  return `https://github.com/${GITHUB_REPO}/blob/main/data/editorials/${issueNumber}.json`;
}

// ---------------------------------------------------------------------------
// JSON extraction from skill output
// ---------------------------------------------------------------------------

function extractJSONFromPaste(text) {
  if (!text || !text.trim()) throw new Error("Nothing pasted");
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found. Make sure you copied the JSON block from the skill output.");
  }
  let parsed;
  try { parsed = JSON.parse(candidate.slice(first, last + 1)); }
  catch (e) { throw new Error(`JSON looks malformed: ${e.message}`); }
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

// ---------------------------------------------------------------------------
// Similarity, tags, CSV
// ---------------------------------------------------------------------------

function normaliseTag(t) { return (t || "").toString().trim().toLowerCase(); }

function similarityScore(a, b) {
  if (a.issueNumber === b.issueNumber) return -1;
  const buckets = ["themes", "geographicFocus", "groupsMentioned", "individualsMentioned"];
  let shared = 0, total = 0;
  for (const k of buckets) {
    const sa = new Set((a[k] || []).map(normaliseTag));
    const sb = new Set((b[k] || []).map(normaliseTag));
    for (const v of sa) { total++; if (sb.has(v)) shared++; }
    for (const v of sb) { if (!sa.has(v)) total++; }
  }
  return total === 0 ? 0 : shared / total;
}

function findSimilar(target, all, limit = 4) {
  return all.map((e) => ({ editorial: e, score: similarityScore(target, e) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

function aggregateTags(editorials, field) {
  const counts = {};
  for (const e of editorials) for (const t of e[field] || []) {
    const n = normaliseTag(t);
    if (n) counts[n] = (counts[n] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function toCSV(editorials) {
  const headers = ["issueNumber","publicationDate","title","summary","themes","geographicFocus","groupsMentioned","individualsMentioned","keyClaims","significanceAssessment","manualNotes"];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [headers.join(",")];
  for (const e of editorials) rows.push(headers.map((h) => escape(e[h])).join(","));
  return rows.join("\n");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

  :root {
    --ink: #f1ead8; --ink-dim: #b3a98f; --ink-faint: #7a7058;
    --paper: #14130f; --paper-2: #1c1a14; --paper-3: #25221a;
    --rule: #2e2a1f; --ochre: #d4a14a; --ochre-dim: #8c6a30; --rust: #b6573a;
  }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', system-ui, sans-serif; background: var(--paper); color: var(--ink); min-height: 100vh; line-height: 1.5; }
  * { box-sizing: border-box; }
  .display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  .anaba-dim { color: var(--ink-dim); } .anaba-faint { color: var(--ink-faint); }
  .anaba-ochre { color: var(--ochre); } .anaba-rust { color: var(--rust); }
  .anaba-button { font-family: 'IBM Plex Sans', sans-serif; background: transparent; color: var(--ink); border: 1px solid var(--rule); padding: 0.5rem 1rem; font-size: 0.875rem; letter-spacing: 0.02em; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; }
  .anaba-button:hover { border-color: var(--ochre); color: var(--ochre); }
  .anaba-button:disabled { opacity: 0.4; cursor: not-allowed; }
  .anaba-button-primary { background: var(--ochre); color: var(--paper); border-color: var(--ochre); font-weight: 500; }
  .anaba-button-primary:hover { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .anaba-button-danger:hover { border-color: var(--rust); color: var(--rust); }
  .anaba-input { font-family: 'IBM Plex Sans', sans-serif; background: var(--paper-2); color: var(--ink); border: 1px solid var(--rule); padding: 0.5rem 0.75rem; font-size: 0.875rem; width: 100%; outline: none; }
  .anaba-input:focus { border-color: var(--ochre); }
  .anaba-textarea { font-family: 'IBM Plex Sans', sans-serif; background: var(--paper-2); color: var(--ink); border: 1px solid var(--rule); padding: 0.75rem; font-size: 0.9rem; width: 100%; outline: none; resize: vertical; line-height: 1.55; }
  .anaba-textarea:focus { border-color: var(--ochre); }
  .anaba-textarea-mono { font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; }
  .anaba-pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; font-size: 0.72rem; font-family: 'IBM Plex Mono', monospace; background: var(--paper-3); color: var(--ink-dim); border: 1px solid var(--rule); letter-spacing: 0.03em; }
  .anaba-pill-ochre { background: rgba(212, 161, 74, 0.08); color: var(--ochre); border-color: var(--ochre-dim); }
  .anaba-pill-rust { background: rgba(182, 87, 58, 0.08); color: var(--rust); border-color: var(--rust); }
  .anaba-card { background: var(--paper-2); border: 1px solid var(--rule); padding: 1.25rem; transition: border-color 0.15s ease; }
  .anaba-card:hover { border-color: var(--ochre-dim); }
  .anaba-card-clickable { cursor: pointer; }
  .anaba-masthead { border-bottom: 1px solid var(--rule); padding: 1.5rem 0 1rem 0; }
  .anaba-masthead-title { font-family: 'Fraunces', serif; font-weight: 500; font-size: 2rem; letter-spacing: -0.01em; line-height: 1.1; }
  .anaba-section-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 0.5rem; }
  .anaba-divider { border: 0; border-top: 1px solid var(--rule); margin: 1.5rem 0; }
  .anaba-paste-zone { border: 1px dashed var(--rule); background: var(--paper-2); padding: 1rem; transition: all 0.15s ease; }
  .anaba-paste-zone:focus-within { border-color: var(--ochre); }
  .anaba-summary-prose { font-family: 'Fraunces', Georgia, serif; font-weight: 400; font-size: 1.025rem; line-height: 1.7; color: var(--ink); }
  .anaba-fade-in { animation: anaba-fade-in 0.3s ease; }
  @keyframes anaba-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .anaba-grain { position: fixed; inset: 0; pointer-events: none; opacity: 0.025; background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"); mix-blend-mode: overlay; z-index: 1; }
  .anaba-banner { background: var(--paper-3); border: 1px solid var(--rule); padding: 0.6rem 0.9rem; font-size: 0.82rem; color: var(--ink-dim); margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: flex-start; }
`;

function Pill({ children, variant = "default", icon: Icon }) {
  const cls = variant === "ochre" ? "anaba-pill anaba-pill-ochre" : variant === "rust" ? "anaba-pill anaba-pill-rust" : "anaba-pill";
  return <span className={cls}>{Icon && <Icon size={10} />}{children}</span>;
}

function SectionLabel({ children }) {
  return <div className="anaba-section-label">{children}</div>;
}

// ---------------------------------------------------------------------------
// Add view: paste skill output, preview, "Open on GitHub" to commit
// ---------------------------------------------------------------------------

function AddView({ onCancel, existing }) {
  const [pasted, setPasted] = useState("");
  const [parseError, setParseError] = useState(null);
  const [draft, setDraft] = useState(null);

  const tryParse = () => {
    setParseError(null);
    try {
      const parsed = extractJSONFromPaste(pasted);
      if (!parsed.issueNumber) throw new Error("The parsed JSON has no issueNumber. Edit the JSON and try again.");
      setDraft(parsed);
    } catch (e) {
      setParseError(e.message);
    }
  };

  if (!draft) {
    return (
      <div className="anaba-fade-in">
        <SectionLabel>Paste the skill output</SectionLabel>
        <div className="anaba-dim" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          In Claude, drop a screenshot of an al-Naba editorial. The al-naba-analyser skill produces a JSON block. Paste it below.
        </div>
        <div className="anaba-paste-zone">
          <textarea className="anaba-textarea anaba-textarea-mono" rows={10} placeholder='Paste the full skill output or just the JSON object.' value={pasted} onChange={(e) => setPasted(e.target.value)} style={{ border: "none", background: "transparent", padding: 0 }} />
        </div>
        {parseError && (
          <div className="anaba-rust" style={{ fontSize: "0.85rem", marginTop: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <AlertCircle size={14} /> {parseError}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button className="anaba-button anaba-button-primary" onClick={tryParse} disabled={!pasted.trim()}>
            <ClipboardPaste size={14} /> Preview
          </button>
          <button className="anaba-button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  const exists = existing[draft.issueNumber];
  const githubURL = githubNewFileURL(draft);

  return (
    <div className="anaba-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <SectionLabel>Preview</SectionLabel>
          <div className="anaba-dim" style={{ fontSize: "0.85rem" }}>
            Confirm everything looks right, then commit it to the repo.
          </div>
        </div>
        {draft.confidence && draft.confidence !== "unknown" && (
          <Pill variant={draft.confidence === "high" ? "ochre" : draft.confidence === "low" ? "rust" : "default"}>confidence: {draft.confidence}</Pill>
        )}
      </div>

      {exists && (
        <div className="anaba-card" style={{ borderColor: "var(--rust)", marginBottom: "1rem" }}>
          <div className="anaba-rust" style={{ fontSize: "0.85rem", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
            <span>Issue {draft.issueNumber} already exists in the tracker. If you commit, you'll need to delete or overwrite the existing file first.</span>
          </div>
        </div>
      )}

      <div className="anaba-card" style={{ marginBottom: "1.5rem" }}>
        <div className="mono anaba-ochre" style={{ fontSize: "0.8rem", marginBottom: "0.3rem" }}>
          ISSUE {draft.issueNumber} {draft.publicationDate && `· ${draft.publicationDate}`}
        </div>
        <div className="display" style={{ fontSize: "1.2rem", fontWeight: 500, marginBottom: "0.75rem" }}>{draft.title}</div>
        <div className="anaba-dim" style={{ fontSize: "0.88rem", lineHeight: 1.55, marginBottom: "0.75rem", whiteSpace: "pre-wrap" }}>{draft.summary}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {draft.themes.slice(0, 6).map((t, i) => <Pill key={`t${i}`} variant="ochre" icon={Tag}>{t}</Pill>)}
          {draft.geographicFocus.slice(0, 4).map((t, i) => <Pill key={`g${i}`} icon={MapPin}>{t}</Pill>)}
        </div>
      </div>

      {GITHUB_REPO ? (
        <>
          <SectionLabel>Commit to the repo</SectionLabel>
          <div className="anaba-dim" style={{ fontSize: "0.85rem", marginBottom: "1rem", lineHeight: 1.55 }}>
            The button below opens GitHub's "Create new file" page with the filename and content pre-filled. Review on GitHub, then click <strong>Commit changes</strong>. The tracker will refresh automatically once the deploy finishes (1 to 2 minutes).
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a className="anaba-button anaba-button-primary" href={githubURL} target="_blank" rel="noopener noreferrer">
              <Github size={14} /> Open on GitHub to commit
            </a>
            <button className="anaba-button" onClick={() => {
              downloadFile(JSON.stringify(draft, null, 2), `${draft.issueNumber}.json`, "application/json");
            }}>
              <Download size={14} /> Download JSON
            </button>
            <button className="anaba-button" onClick={() => setDraft(null)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button className="anaba-button" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="anaba-banner">
            <AlertCircle size={14} className="anaba-rust" style={{ flexShrink: 0, marginTop: "0.15rem" }} />
            <span>GitHub repo isn't configured (VITE_GITHUB_REPO env var). You can download the JSON below and upload it manually to <code>data/editorials/</code> in your repo.</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="anaba-button anaba-button-primary" onClick={() => {
              downloadFile(JSON.stringify(draft, null, 2), `${draft.issueNumber}.json`, "application/json");
            }}>
              <Download size={14} /> Download JSON
            </button>
            <button className="anaba-button" onClick={() => setDraft(null)}><ArrowLeft size={14} /> Back</button>
            <button className="anaba-button" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
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
    for (const t of b[field] || []) if (sa.has(normaliseTag(t))) shared.push(t);
  }
  if (shared.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
      {shared.slice(0, 6).map((t, i) => <Pill key={i} variant="ochre">{t}</Pill>)}
    </div>
  );
}

function DetailView({ editorial, allEditorials, onBack, onSelect }) {
  const similar = useMemo(() => findSimilar(editorial, allEditorials), [editorial, allEditorials]);
  const editURL = githubEditFileURL(editorial.issueNumber);
  const viewURL = githubViewFileURL(editorial.issueNumber);

  return (
    <div className="anaba-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem", gap: "0.5rem", flexWrap: "wrap" }}>
        <button className="anaba-button" onClick={onBack}><ArrowLeft size={14} /> Library</button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {editURL && (
            <a className="anaba-button" href={editURL} target="_blank" rel="noopener noreferrer">
              <Edit3 size={14} /> Edit on GitHub
            </a>
          )}
          {viewURL && (
            <a className="anaba-button anaba-button-danger" href={viewURL} target="_blank" rel="noopener noreferrer" title="Delete via GitHub: click the trash icon at the top right of the file view">
              <Trash2 size={14} /> Delete on GitHub
            </a>
          )}
        </div>
      </div>
      <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span className="mono anaba-ochre" style={{ fontSize: "0.875rem", letterSpacing: "0.05em" }}>ISSUE {editorial.issueNumber}</span>
        {editorial.publicationDate && (
          <span className="mono anaba-faint" style={{ fontSize: "0.8rem" }}>· {editorial.publicationDate}</span>
        )}
      </div>
      <h1 className="display" style={{ fontSize: "2rem", fontWeight: 500, lineHeight: 1.15, marginBottom: "1.5rem", marginTop: 0 }}>{editorial.title}</h1>
      <hr className="anaba-divider" />
      <SectionLabel>Summary</SectionLabel>
      <div className="anaba-summary-prose" style={{ marginBottom: "2rem", whiteSpace: "pre-wrap" }}>{editorial.summary}</div>
      {editorial.significanceAssessment && (
        <>
          <SectionLabel>Significance</SectionLabel>
          <div className="anaba-summary-prose" style={{ marginBottom: "2rem", fontStyle: "italic", color: "var(--ink-dim)" }}>{editorial.significanceAssessment}</div>
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
      {editorial.manualNotes && (
        <>
          <hr className="anaba-divider" />
          <SectionLabel>Analyst notes</SectionLabel>
          <div className="anaba-dim" style={{ fontSize: "0.95rem", marginBottom: "2rem", whiteSpace: "pre-wrap" }}>{editorial.manualNotes}</div>
        </>
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

function LibraryView({ editorials, onSelect, onAdd, onExportCSV, filter, setFilter, tagFilter, setTagFilter }) {
  const sorted = useMemo(() => [...editorials].sort((a, b) => (b.issueNumber || 0) - (a.issueNumber || 0)), [editorials]);

  const filtered = useMemo(() => {
    let result = sorted;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((e) => String(e.issueNumber).includes(q) || (e.title || "").toLowerCase().includes(q) || (e.summary || "").toLowerCase().includes(q) || (e.manualNotes || "").toLowerCase().includes(q));
    }
    if (tagFilter) {
      const tf = normaliseTag(tagFilter);
      result = result.filter((e) => [...(e.themes || []), ...(e.geographicFocus || []), ...(e.groupsMentioned || []), ...(e.individualsMentioned || [])].some((t) => normaliseTag(t) === tf));
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
          <div className="anaba-dim" style={{ fontSize: "0.85rem" }}>{editorials.length} editorial{editorials.length === 1 ? "" : "s"} tracked</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="anaba-button" onClick={onExportCSV} disabled={editorials.length === 0}><Download size={14} /> CSV</button>
          <button className="anaba-button anaba-button-primary" onClick={onAdd}><Plus size={14} /> Add editorial</button>
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
            <button className="anaba-button" onClick={() => setTagFilter("")}><X size={14} /> Tag: {tagFilter}</button>
          )}
        </div>
      )}
      {editorials.length === 0 ? (
        <div className="anaba-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <Library size={28} className="anaba-faint" style={{ margin: "0 auto 1rem", display: "block" }} />
          <div className="display" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>The library is empty</div>
          <div className="anaba-dim" style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Add an editorial by pasting the output of the al-naba-analyser skill.</div>
          <button className="anaba-button anaba-button-primary" onClick={onAdd}><Plus size={14} /> Add the first one</button>
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
  const [view, setView] = useState("library");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [filter, setFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const editorialList = useMemo(() => Object.values(ALL_EDITORIALS), []);

  const handleExportCSV = () => {
    const csv = toCSV(editorialList);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `al-naba-tracker-${date}.csv`, "text/csv;charset=utf-8");
  };

  const repoURL = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}` : null;

  return (
    <>
      <style>{styles}</style>
      <div className="anaba-grain" />
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "2rem 1.5rem 5rem", position: "relative", zIndex: 2 }}>
        <div className="anaba-masthead">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div className="mono anaba-faint" style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                Public analytical tracker
              </div>
              <div className="anaba-masthead-title display">al-Nabaʾ editorials</div>
            </div>
            {repoURL && (
              <a className="anaba-button" href={repoURL} target="_blank" rel="noopener noreferrer">
                <Github size={14} /> Repo
              </a>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          {view === "add" ? (
            <AddView existing={ALL_EDITORIALS} onCancel={() => setView("library")} />
          ) : view === "detail" && ALL_EDITORIALS[selectedIssue] ? (
            <DetailView
              editorial={ALL_EDITORIALS[selectedIssue]}
              allEditorials={editorialList}
              onBack={() => setView("library")}
              onSelect={(n) => { setSelectedIssue(n); window.scrollTo(0, 0); }}
            />
          ) : (
            <LibraryView
              editorials={editorialList}
              onSelect={(n) => { setSelectedIssue(n); setView("detail"); window.scrollTo(0, 0); }}
              onAdd={() => setView("add")}
              onExportCSV={handleExportCSV}
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
