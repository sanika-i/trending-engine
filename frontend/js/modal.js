function openModal() {
  document.getElementById("modal-backdrop").classList.remove("hidden");
  setTimeout(() => document.getElementById("input-description").focus(), 50);
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("input-author").value = "";
  document.getElementById("input-description").value = "";
  document.getElementById("input-likes").value        = "0";
  document.getElementById("input-shares").value       = "0";
  document.getElementById("input-saves").value        = "0";
}

async function submitAdd() {
  const author = document.getElementById("input-author").value.trim();
  const desc = document.getElementById("input-description").value.trim();
  if (!desc) { toast("Description is required"); return; }

  try {
    await api.add({
      author: author, 
      description: desc,
      likes:  +document.getElementById("input-likes").value  || 0,
      shares: +document.getElementById("input-shares").value || 0,
      saves:  +document.getElementById("input-saves").value  || 0,
    });
    closeModal();
    toast("Post added ✓");
    refresh();
  } catch (err) {
    toast("Add failed: " + err.message);
  }
}

document.getElementById("btn-open-add").onclick    = openModal;
document.getElementById("btn-close-modal").onclick = closeModal;
document.getElementById("btn-cancel-add").onclick  = closeModal;
document.getElementById("btn-submit-add").onclick  = submitAdd;


document.getElementById("modal-backdrop").onclick = (e) => {
  if (e.target === document.getElementById("modal-backdrop")) closeModal();
};

document.getElementById("history-modal").onclick = (e) => {
  if (e.target.id === "history-modal") closeHistoryModal();
};

async function openHistoryModal(postId) {
  const modal = document.getElementById("history-modal");
  const body  = document.getElementById("history-modal-body");

  modal.classList.remove("hidden");
  body.innerHTML = "Loading...";

  try {
    const data = await api.history({ post_id: postId });

    if (!data.length) {
      body.innerHTML = "<div class='empty'>No history found</div>";
      return;
    }

    body.innerHTML = data.map(h => `
      <div class="post">
        <div class="post-body">
          <div class="post-header">
            <span class="post-time">${new Date(h.timestamp).toLocaleString()}</span>
          </div>

          <div class="post-text">
            Event: ${h.event_type}<br>
            Likes: ${h.likes} | Shares: ${h.shares} | Saves: ${h.saves}
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    body.innerHTML = "Failed to load history";
  }
}

function closeHistoryModal() {
  document.getElementById("history-modal").classList.add("hidden");
}