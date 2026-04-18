
const AVATAR_COLORS = [
  "#1d9bf0", "#7856ff", "#00ba7c", "#f91880",
  "#ff7043", "#26c6da", "#ab47bc", "#ffa726",
];

const ICONS = {
  heart: `<svg viewBox="0 0 10 9"><path d="M5 8.5S.5 5.5.5 2.8A2.3 2.3 0 015 1.6a2.3 2.3 0 014.5 1.2C9.5 5.5 5 8.5 5 8.5z"/></svg>`,
  share: `<svg viewBox="0 0 10 10"><path d="M1 5l3-3v2h2c2 0 3 1.5 3 3 0-1-1-2-3-2H4v2L1 5z"/></svg>`,
  save:  `<svg viewBox="0 0 10 11"><path d="M2 1h6v9L5 7.5 2 10V1z"/></svg>`,
};

function avatarColor(id)  { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function avatarLetter(desc) { return (desc || "?")[0].toUpperCase(); }

function relTime(iso) {
  const ms = Date.now() - new Date(iso);
  const m  = Math.floor(ms / 60000);
  const h  = Math.floor(ms / 3600000);
  const d  = Math.floor(ms / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d === 1) return "1d";
  return `${d}d`;
}

function fmtScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function rankBadge(i) {
  const n   = i + 1;
  const cls = n === 1 ? "rank-1" : n === 2 ? "rank-2" : n === 3 ? "rank-3" : "";
  const lbl = n === 1 ? "🥇 #1"  : n === 2 ? "🥈 #2"  : n === 3 ? "🥉 #3"  : `#${n}`;
  return `<span class="post-rank-badge ${cls}">${lbl}</span>`;
}

function emptyState() {
  return `<div class="empty">
    <div class="empty-icon">+</div>
    <h3>No posts yet</h3>
    <p>Hit "+ Post" to add the first entry</p>
  </div>`;
}

async function renderHome() {
  const feed  = document.getElementById("leaderboard-feed");
  const posts = await api.leaderboard();

  if (!posts.length) { feed.innerHTML = emptyState(); return; }

  const maxScore = posts[0]?.score || 1;

  feed.innerHTML = posts.map((p, i) => `
    <div class="post">
      <div class="post-avatar" style="background:${avatarColor(p.id)}">${avatarLetter(p.description)}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="post-handle">@${escHtml(p.author || "unknown")}</span>
          <span class="post-time">· ${relTime(p.created_at)}</span>
          ${rankBadge(i)}
        </div>
        <div class="post-text">${escHtml(p.description)}</div>
        <div class="post-stats">
          <div class="stat"><div class="stat-dot heart"></div><span class="stat-val">${p.likes}</span><span style="font-size:12px;color:var(--muted)">likes</span></div>
          <div class="stat"><div class="stat-dot share"></div><span class="stat-val">${p.shares}</span><span style="font-size:12px;color:var(--muted)">shares</span></div>
          <div class="stat"><div class="stat-dot save"></div><span class="stat-val">${p.saves}</span><span style="font-size:12px;color:var(--muted)">saves</span></div>
        </div>
        <div class="score-bar-wrap">
          <div class="score-label">
            <span class="score-label-text">score</span>
            <span class="score-label-val">${fmtScore(p.score)}</span>
          </div>
          <div class="score-bar-track">
            <div class="score-bar-fill" style="width:${Math.round((p.score / maxScore) * 100)}%"></div>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

async function renderList() {
  const feed  = document.getElementById("post-feed");
  const posts = await api.posts(state.sortBy, state.order);

  document.querySelectorAll(".sort-chip").forEach(el => {
    const active = el.dataset.sort === state.sortBy;
    el.classList.toggle("active", active);
    el.querySelector(".sort-dir").textContent = active
      ? (state.order === "asc" ? "↑" : "↓") : "";
  });

  if (!posts.length) { feed.innerHTML = emptyState(); return; }

  feed.innerHTML = posts.map(p => `
    <div class="post">
      <div class="post-avatar" style="background:${avatarColor(p.id)}">${avatarLetter(p.description)}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="post-handle">@${escHtml(p.author || "unknown")}</span>
          <span class="post-time">· ${relTime(p.created_at)}</span>
          <span class="post-rank-badge" style="margin-left:auto">${fmtScore(p.score)} pts</span>
        </div>
        <div class="post-text">${escHtml(p.description)}</div>
        <div class="post-engage">
          <button class="eng-btn like"  data-action="like"  data-id="${p.id}">
            <span class="eng-icon">${ICONS.heart}</span>
            <span class="eng-count">${p.likes}</span>
          </button>
          <button class="eng-btn share" data-action="share" data-id="${p.id}">
            <span class="eng-icon">${ICONS.share}</span>
            <span class="eng-count">${p.shares}</span>
          </button>
          <button class="eng-btn save"  data-action="save"  data-id="${p.id}">
            <span class="eng-icon">${ICONS.save}</span>
            <span class="eng-count">${p.saves}</span>
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

async function renderStats() {
  const data = await api.info();
  const container = document.getElementById("stats-feed");

  function renderBlock(title, stats) {
    return `
      <div class="post">
        <div class="post-body">
          <div class="post-header">
            <span class="post-handle">${title}</span>
          </div>

          <div class="post-text">
            Mean: ${stats.mean.toFixed(2)} <br>
            Median: ${stats.median.toFixed(2)} <br>
            Q1: ${stats.q1.toFixed(2)} <br>
            Q3: ${stats.q3.toFixed(2)} <br>
            Std Dev: ${stats.stddev.toFixed(2)} <br>
            P90: ${stats.p90.toFixed(2)} <br>
            P99: ${stats.p99.toFixed(2)} <br>
            Min: ${stats.min} <br>
            Max: ${stats.max}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="post">
      <div class="post-body">
        <div class="post-header">
          <span class="post-handle">Overview</span>
        </div>
        <div class="post-text">
          Total Posts: ${data.total_posts}
        </div>
      </div>
    </div>

    ${renderBlock("Likes", data.likes)}
    ${renderBlock("Shares", data.shares)}
    ${renderBlock("Saves", data.saves)}
    ${renderBlock("Score", data.score)}

    <div class="post">
      <div class="post-body">
        <div class="post-header">
          <span class="post-handle">Score Distribution</span>
        </div>
        <div class="post-text">
          Buckets: ${data.score_distribution.bucket_edges.join(", ")} <br>
          Counts: ${data.score_distribution.counts.join(", ")}
        </div>
      </div>
    </div>
  `;
}
