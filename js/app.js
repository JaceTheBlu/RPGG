/* Shared helpers: GitHub-as-a-database for the static RPG CRM site.
 *
 * Security model: the repo is PUBLIC (private hosting costs money on this
 * plan), so every .md file is already fetchable by anyone who knows or
 * guesses the raw GitHub URL — logging in on this site does not change
 * that. The password screen is a soft "who are you" gate for normal use
 * of the UI (pick your identity, get the matching interface), not real
 * access control. Don't put anything in content/pages/gm/ that a
 * motivated player couldn't be trusted to stumble onto.
 *
 * Only the GM can create/update/delete pages, so only the GM's browser
 * needs a GitHub personal access token (entered at login, never stored in
 * the repo). Everyone else just reads public GitHub API endpoints.
 */

const RPGG = (() => {
  const PUBLIC_DIR = "content/pages/public";
  const GM_DIR = "content/pages/gm";
  const USERS_PATH = "content/users.json";
  const DEFAULTS = { owner: "jacetheblu", repo: "rpgg", branch: "main" };

  function dirFor(visibility) {
    return visibility === "gm" ? GM_DIR : PUBLIC_DIR;
  }

  function getConfig() {
    const stored = JSON.parse(localStorage.getItem("rpgg.config") || "{}");
    return { ...DEFAULTS, ...stored };
  }

  function setConfig(partial) {
    const current = getConfig();
    localStorage.setItem("rpgg.config", JSON.stringify({ ...current, ...partial }));
  }

  // --- Session (login) -----------------------------------------------

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("rpgg.session") || "null");
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem("rpgg.session", JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem("rpgg.session");
  }

  /** Call at the top of every page. Redirects to login if needed. */
  function requireSession() {
    const session = getSession();
    if (!session) {
      location.href = "login.html";
      return null;
    }
    return session;
  }

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function fetchUsers() {
    const data = await ghGet(USERS_PATH);
    if (!data) return [];
    return JSON.parse(fromBase64Utf8(data.content));
  }

  /**
   * Checks username/password against content/users.json. `token` is only
   * required (and only used) when the matched user has role "gm".
   */
  async function login(username, password, token) {
    const users = await fetchUsers();
    const entry = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!entry) throw new Error("Utilisateur inconnu.");

    const hash = await sha256Hex(password);
    if (hash !== entry.passwordHash) throw new Error("Mot de passe incorrect.");

    const role = entry.role === "gm" ? "gm" : "player";
    if (role === "gm") {
      if (!token) throw new Error("Un token GitHub est requis pour le rôle MJ.");
      const meRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (!meRes.ok) throw new Error("Token GitHub invalide.");
    }

    const session = {
      username: entry.username,
      displayName: entry.displayName || entry.username,
      role,
      token: role === "gm" ? token : null,
    };
    setSession(session);
    return session;
  }

  // --- Low-level GitHub API helpers -----------------------------------

  function slugify(title) {
    return title
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "page";
  }

  function apiUrl(path) {
    const { owner, repo } = getConfig();
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  }

  function authHeaders(token) {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function ghGet(path, token) {
    const { branch } = getConfig();
    const res = await fetch(`${apiUrl(path)}?ref=${branch}`, { headers: authHeaders(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API ${res.status} sur ${path}`);
    return res.json();
  }

  async function ghList(path, token) {
    const { branch } = getConfig();
    const res = await fetch(`${apiUrl(path)}?ref=${branch}`, { headers: authHeaders(token) });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Impossible de lister ${path} (${res.status}).`);
    return res.json();
  }

  async function ghWrite(path, token, options) {
    if (!token) throw new Error("Action réservée au MJ (token GitHub manquant).");
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: { ...authHeaders(token), ...(options.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`GitHub API ${res.status}: ${body.message || res.statusText}`);
    }
    return res.status === 204 ? null : res.json();
  }

  function toBase64Utf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64Utf8(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }

  // --- Pages ------------------------------------------------------------

  async function listPages({ includeGm }) {
    const dirs = includeGm ? [["public", PUBLIC_DIR], ["gm", GM_DIR]] : [["public", PUBLIC_DIR]];
    const results = [];
    for (const [visibility, dir] of dirs) {
      const items = await ghList(dir);
      for (const it of items) {
        if (it.type === "file" && it.name.endsWith(".md")) {
          results.push({ slug: it.name.replace(/\.md$/, ""), visibility });
        }
      }
    }
    return results;
  }

  async function fetchPage(slug, visibility) {
    const data = await ghGet(`${dirFor(visibility)}/${slug}.md`);
    if (!data) throw new Error("Page introuvable.");
    return fromBase64Utf8(data.content);
  }

  function parseFrontMatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: raw };
    const meta = {};
    for (const line of match[1].split("\n")) {
      const m = line.match(/^([\w-]+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].replace(/^"|"$/g, "");
    }
    return { meta, body: match[2] };
  }

  function buildFrontMatter(meta) {
    const lines = Object.entries(meta).map(([k, v]) => `${k}: "${String(v).replace(/"/g, '\\"')}"`);
    return `---\n${lines.join("\n")}\n---\n\n`;
  }

  async function getFileSha(path, token) {
    const data = await ghGet(path, token);
    return data ? data.sha : null;
  }

  async function publishPage({ slug, title, markdown, visibility, token }) {
    const path = `${dirFor(visibility)}/${slug}.md`;
    const { branch } = getConfig();
    const sha = await getFileSha(path, token);
    const content = buildFrontMatter({ title, visibility, updated: new Date().toISOString() }) + markdown;
    return ghWrite(path, token, {
      method: "PUT",
      body: JSON.stringify({
        message: sha ? `Update page: ${title}` : `Add page: ${title}`,
        content: toBase64Utf8(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  async function deletePage(slug, visibility, title, token) {
    const path = `${dirFor(visibility)}/${slug}.md`;
    const { branch } = getConfig();
    const sha = await getFileSha(path, token);
    if (!sha) throw new Error("Page introuvable.");
    return ghWrite(path, token, {
      method: "DELETE",
      body: JSON.stringify({ message: `Delete page: ${title || slug}`, sha, branch }),
    });
  }

  function renderMarkdown(md) {
    return marked.parse(md, { breaks: true });
  }

  return {
    getConfig,
    setConfig,
    getSession,
    setSession,
    clearSession,
    requireSession,
    sha256Hex,
    login,
    slugify,
    listPages,
    fetchPage,
    parseFrontMatter,
    publishPage,
    deletePage,
    renderMarkdown,
  };
})();
