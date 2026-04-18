
const state = {
  view:   "home",
  sortBy: "score",
  order:  "desc",
};

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function show(view) {
  state.view = view;

  document.getElementById("home-view").classList.toggle("hidden", view !== "home");
  document.getElementById("list-view").classList.toggle("hidden", view !== "list");
  document.getElementById("stats-view").classList.toggle("hidden", view !== "stats");

  document.getElementById("tab-home").classList.toggle("active", view === "home");
  document.getElementById("tab-list").classList.toggle("active", view === "list");
  document.getElementById("tab-stats").classList.toggle("active", view === "stats");

  refresh();
}

async function refresh() {
  try {
    if (state.view === "home") await renderHome();
    else if (state.view === "list") await renderList();
    else if (state.view === "stats") await renderStats();
  } catch (err) {
    toast("Error: " + err.message);
    console.error(err);
  }
}

document.querySelectorAll(".sort-chip").forEach(el => {
  el.onclick = () => {
    const col = el.dataset.sort;
    if (state.sortBy === col) {
      state.order = state.order === "asc" ? "desc" : "asc";
    } else {
      state.sortBy = col;
      state.order  = col === "description" ? "asc" : "desc";
    }
    refresh();
  };
});

document.getElementById("post-feed").onclick = async (e) => {
  const btn = e.target.closest("button.eng-btn");
  if (!btn) return;
  const { id, action } = btn.dataset;
  try {
    await api[action](id);
    refresh();
  } catch (err) {
    toast("Failed: " + err.message);
  }
};

refresh();
setInterval(refresh, 10000);
