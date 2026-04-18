
const AVATAR_COLORS = [
  "#1d9bf0", "#7856ff", "#00ba7c", "#f91880",
  "#ff7043", "#26c6da", "#ab47bc", "#ffa726",
];

const ICONS = {
  heart: `<svg viewBox="0 0 10 9"><path d="M5 8.5S.5 5.5.5 2.8A2.3 2.3 0 015 1.6a2.3 2.3 0 014.5 1.2C9.5 5.5 5 8.5 5 8.5z"/></svg>`,
  share: `<svg viewBox="0 0 10 10"><path d="M1 5l3-3v2h2c2 0 3 1.5 3 3 0-1-1-2-3-2H4v2L1 5z"/></svg>`,
  save: `<svg viewBox="0 0 10 11"><path d="M2 1h6v9L5 7.5 2 10V1z"/></svg>`,
  history: `<svg viewBox="0 0 10 10"><path d="M5 1a4 4 0 100 8A4 4 0 005 1zM5 3v2.5l1.5 1"/></svg>`,
};

let _scoreChart = null;

function avatarColor(id) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function avatarLetter(auth) { return (auth || "?")[0].toUpperCase(); }

function relTime(iso) {
  const ms = Date.now() - new Date(iso);
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (m < 1) return "just now";
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
  const n = i + 1;
  const cls = n === 1 ? "rank-1" : n === 2 ? "rank-2" : n === 3 ? "rank-3" : "";
  const lbl = n === 1 ? "🥇 #1" : n === 2 ? "🥈 #2" : n === 3 ? "🥉 #3" : `#${n}`;
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
  const feed = document.getElementById("leaderboard-feed");
  const posts = await api.leaderboard();

  if (!posts.length) { feed.innerHTML = emptyState(); return; }

  const maxScore = posts[0]?.score || 1;

  feed.innerHTML = posts.map((p, i) => `
    <div class="post">
      <div class="post-avatar" style="background:${avatarColor(p.id)}">${avatarLetter(p.author)}</div>
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
  const feed = document.getElementById("post-feed");
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
      <div class="post-avatar" style="background:${avatarColor(p.id)}">${avatarLetter(p.author)}</div>
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
          <button class="eng-btn history" data-action="history" data-id="${p.id}" onclick="openHistoryModal(${p.id})">
            <span class="eng-icon">${ICONS.history}</span>
            <span class="eng-count">History</span>
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

async function renderStats() {
  const container = document.getElementById("stats-feed");
  const data = await api.info();

  function statRow(label, val) {
    return `<div class="stat-row"><span>${label}</span><span>${val}</span></div>`;
  }

  function renderBlock(title, s) {
    return `
      <div class="stat-card">
        <div class="stat-title">${title}</div>
        ${statRow("Min", s.min)}
        ${statRow("Q1", s.q1.toFixed(1))}
        ${statRow("Median", s.median.toFixed(1))}
        ${statRow("Q3", s.q3.toFixed(1))}
        ${statRow("Max", s.max)}
        ${statRow("Std Dev", s.stddev.toFixed(1))}
      </div>
    `;
  }

  const skewed = data.score.median < data.score.mean;
  const volatile = data.score.stddev > 20;

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Total Posts</div>
        <div class="kpi-value">${data.total_posts}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Avg Score</div>
        <div class="kpi-value">${data.score.mean.toFixed(0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Median Score</div>
        <div class="kpi-value">${data.score.median.toFixed(0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Top Score</div>
        <div class="kpi-value">${data.score.max}</div>
      </div>
    </div>
    <div class="stat-grid">
      ${renderBlock("Likes", data.likes)}
      ${renderBlock("Shares", data.shares)}
      ${renderBlock("Saves", data.saves)}
      ${renderBlock("Score", data.score)}
    </div>
    <div class="chart-card">
      <div class="stat-title">Score Distribution</div>
      <canvas id="scoreChart"></canvas>
    </div>
    <div class="insight-card">
      <div class="stat-title">Insights</div>
      <p>Median (${data.score.median.toFixed(0)}) is ${skewed ? "lower" : "higher"} than mean
         (${data.score.mean.toFixed(0)}), indicating
         ${skewed ? "a few high-performing posts skew the average upward." : "score distribution is fairly balanced."}</p>
      <p>Standard deviation of ${data.score.stddev.toFixed(0)} suggests
         ${volatile ? "inconsistent engagement, viral spikes dominate." : "relatively consistent engagement across posts."}</p>
    </div>
  `;
  if (_scoreChart) {
    _scoreChart.destroy();
    _scoreChart = null;
  }

  const edges = data.score_distribution.bucket_edges;
  const counts = data.score_distribution.counts;
  const labels = counts.map((_, i) =>
    `${edges[i].toFixed(0)}–${edges[i + 1].toFixed(0)}`
  );

  _scoreChart = new Chart(document.getElementById("scoreChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Posts",
        data: counts,
        backgroundColor: "rgba(17, 135, 214, 0.45)",
        borderColor: "rgba(17, 135, 214, 0.45)",
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Score range: ${items[0].label}`,
            label: (item) => `${item.raw} post${item.raw !== 1 ? "s" : ""}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#71767b",
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 45,
          },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#71767b", stepSize: 1 },
          grid: { display: false },
          beginAtZero: true,
        },
      },
    },
  });
}

async function renderPerformance() {
  try {
    const data = await api.performance();
    const container = document.getElementById("performance-feed");

    if (!data.endpoints.length) {
      container.innerHTML = emptyState();
      return;
    }

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">Endpoints Tracked</div>
          <div class="kpi-value">${data.endpoints.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Overall Avg</div>
          <div class="kpi-value">${data.overall_avg_ms.toFixed(1)}<span style="font-size:14px;font-weight:400;color:var(--muted)"> ms</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Fastest Avg</div>
          <div class="kpi-value">${Math.min(...data.endpoints.map(e => e.avg_ms)).toFixed(1)}<span style="font-size:14px;font-weight:400;color:var(--muted)"> ms</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Slowest Avg</div>
          <div class="kpi-value">${Math.max(...data.endpoints.map(e => e.avg_ms)).toFixed(1)}<span style="font-size:14px;font-weight:400;color:var(--muted)"> ms</span></div>
        </div>
      </div>

      <div class="stat-grid">
        ${data.endpoints.map(ep => `
          <div class="stat-card">
            <div class="stat-title">
              <span style="color:var(--accent);font-family:var(--mono);font-size:11px;margin-right:6px">${ep.method}</span>${ep.endpoint}
            </div>
            <div class="stat-row"><span>Calls</span><span>${ep.call_count}</span></div>
            <div class="stat-row"><span>Avg</span><span>${ep.avg_ms.toFixed(2)} ms</span></div>
            <div class="stat-row"><span>Min</span><span>${ep.min_ms.toFixed(2)} ms</span></div>
            <div class="stat-row"><span>Max</span><span>${ep.max_ms.toFixed(2)} ms</span></div>
          </div>
        `).join("")}
      </div>
    `;

  } catch (err) {
    toast("Performance load failed: " + err.message);
  }
}
