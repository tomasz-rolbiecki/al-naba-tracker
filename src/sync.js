// Sync layer using a private GitHub Gist as the backing store.
// Free, cross-device, uses existing GitHub account.
// Last-write-wins conflict resolution per-issue based on updatedAt.

const PAT_KEY = "al-naba-sync-pat";
const GIST_KEY = "al-naba-sync-gist";
const LAST_SYNC_KEY = "al-naba-last-sync";
const GIST_FILE = "al-naba-tracker.json";

export function getSyncConfig() {
  if (typeof window === "undefined") return { pat: "", gistId: "" };
  return {
    pat: localStorage.getItem(PAT_KEY) || "",
    gistId: localStorage.getItem(GIST_KEY) || "",
  };
}

export function setSyncConfig({ pat, gistId }) {
  if (pat !== undefined) localStorage.setItem(PAT_KEY, pat);
  if (gistId !== undefined) localStorage.setItem(GIST_KEY, gistId);
}

export function clearSyncConfig() {
  localStorage.removeItem(PAT_KEY);
  localStorage.removeItem(GIST_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

export function getLastSync() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function isSyncEnabled() {
  const { pat, gistId } = getSyncConfig();
  return Boolean(pat && gistId);
}

function authHeaders(pat) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function interpretError(res, kind) {
  if (res.status === 401) {
    return new Error("Token rejected. The PAT may be invalid or missing the 'gist' scope.");
  }
  if (res.status === 404) {
    return new Error("Gist not found. The Gist ID may be wrong, or the PAT doesn't have access to it.");
  }
  if (res.status === 403) {
    return new Error("Rate limit or permission issue. Try again in a minute.");
  }
  return new Error(`${kind} failed: HTTP ${res.status}`);
}

export async function pullFromGist() {
  const { pat, gistId } = getSyncConfig();
  if (!pat || !gistId) throw new Error("Sync not configured");

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: authHeaders(pat),
  });
  if (!res.ok) throw interpretError(res, "Pull");

  const gist = await res.json();
  const file = gist.files?.[GIST_FILE];
  if (!file) return {};

  let content;
  if (file.truncated) {
    const raw = await fetch(file.raw_url);
    if (!raw.ok) throw new Error(`Could not fetch full gist content: ${raw.status}`);
    content = await raw.text();
  } else {
    content = file.content;
  }

  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function pushToGist(editorials) {
  const { pat, gistId } = getSyncConfig();
  if (!pat || !gistId) throw new Error("Sync not configured");

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: { ...authHeaders(pat), "Content-Type": "application/json" },
    body: JSON.stringify({
      files: {
        [GIST_FILE]: {
          content: JSON.stringify(editorials, null, 2),
        },
      },
    }),
  });
  if (!res.ok) throw interpretError(res, "Push");

  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export async function createGist(pat, initialData = {}) {
  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: { ...authHeaders(pat), "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "al-Naba tracker data",
      public: false,
      files: {
        [GIST_FILE]: {
          content: JSON.stringify(initialData, null, 2),
        },
      },
    }),
  });
  if (!res.ok) throw interpretError(res, "Create gist");

  const gist = await res.json();
  return gist.id;
}

// Merge by issue number. For each issue present on either side, take the one
// with the later updatedAt timestamp. Does not handle deletions (a deletion on
// one device while the other is offline will be undone by the next merge).
export function mergeEditorials(local, remote) {
  const merged = { ...local };
  for (const [k, v] of Object.entries(remote || {})) {
    if (!merged[k]) {
      merged[k] = v;
      continue;
    }
    const localTime = new Date(merged[k].updatedAt || merged[k].createdAt || 0).getTime();
    const remoteTime = new Date(v.updatedAt || v.createdAt || 0).getTime();
    if (remoteTime > localTime) merged[k] = v;
  }
  return merged;
}
