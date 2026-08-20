/* Shared helpers: GitHub-as-a-database for the static RPG CRM site. */

const RPGG = (() => {
  const CONTENT_DIR = "content/pages";
  const DEFAULTS = { owner: "jacetheblu", repo: "rpgg", branch: "main" };

  function getConfig() {
    const stored = JSON.parse(localStorage.getItem("rpgg.config") || "{}");
    return { ...DEFAULTS, ...stored };
  }

  function setConfig(partial) {
    const current = getConfig();
    localStorage.setItem("rpgg.config", JSON.stringify({ ...current, ...partial }));
  }

  function getToken() {
    return localStorage.getItem("rpgg.token") || "";
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem("rpgg.token", token);
    } else {
      localStorage.removeItem("rpgg.token");
    }
  }

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

  function rawUrl(path) {
    const { owner, repo, branch } = getConfig();
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  async function ghRequest(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Aucun token GitHub configuré. Ouvre les réglages (⚙) pour en ajouter un.");
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        ...(options.headers || {}),
      },
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

  async function listPages() {
    const { branch } = getConfig();
    const res = await fetch(`${apiUrl(CONTENT_DIR)}?ref=${branch}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Impossible de lister les pages (${res.status}).`);
    const items = await res.json();
    return items
      .filter((it) => it.type === "file" && it.name.endsWith(".md"))
      .map((it) => ({ slug: it.name.replace(/\.md$/, ""), path: it.path }));
  }

  async function fetchPage(slug) {
    const res = await fetch(`${rawUrl(`${CONTENT_DIR}/${slug}.md`)}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Page introuvable (${res.status}).`);
    return res.text();
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

  async function getFileSha(path) {
    const { branch } = getConfig();
    const res = await fetch(`${apiUrl(path)}?ref=${branch}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Erreur lors de la vérification du fichier (${res.status}).`);
    const data = await res.json();
    return data.sha;
  }

  async function publishPage({ slug, title, markdown }) {
    const path = `${CONTENT_DIR}/${slug}.md`;
    const { branch } = getConfig();
    const sha = await getFileSha(path);
    const content = buildFrontMatter({ title, updated: new Date().toISOString() }) + markdown;
    return ghRequest(path, {
      method: "PUT",
      body: JSON.stringify({
        message: sha ? `Update page: ${title}` : `Add page: ${title}`,
        content: toBase64Utf8(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  async function deletePage(slug, title) {
    const path = `${CONTENT_DIR}/${slug}.md`;
    const { branch } = getConfig();
    const sha = await getFileSha(path);
    if (!sha) throw new Error("Page introuvable.");
    return ghRequest(path, {
      method: "DELETE",
      body: JSON.stringify({ message: `Delete page: ${title || slug}`, sha, branch }),
    });
  }

  function renderMarkdown(md) {
    return marked.parse(md, { breaks: true });
  }

  return {
    CONTENT_DIR,
    getConfig,
    setConfig,
    getToken,
    setToken,
    slugify,
    listPages,
    fetchPage,
    parseFrontMatter,
    publishPage,
    deletePage,
    renderMarkdown,
  };
})();
