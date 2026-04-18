const API_BASE = "http://127.0.0.1:8000";

async function req(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

const api = {
  leaderboard: () => req("/leaderboard"),
  posts: (s, o) => req(`/posts?sort_by=${s}&order=${o}`),
  add: (body) => req("/add", { method: "POST", body: JSON.stringify(body) }),
  like: (id) => req(`/posts/${id}/like`,  { method: "POST" }),
  share: (id) => req(`/posts/${id}/share`, { method: "POST" }),
  save: (id) => req(`/posts/${id}/save`,  { method: "POST" }),
  info: () => req("/info"),
  history: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return req(`/history${query ? `?${query}` : ""}`);
  },
  performance: () => req("/performance"),
};
