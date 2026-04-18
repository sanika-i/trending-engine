function openModal() {
  document.getElementById("modal-backdrop").classList.remove("hidden");
  setTimeout(() => document.getElementById("input-description").focus(), 50);
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("input-description").value = "";
  document.getElementById("input-likes").value        = "0";
  document.getElementById("input-shares").value       = "0";
  document.getElementById("input-saves").value        = "0";
}

async function submitAdd() {
  const desc = document.getElementById("input-description").value.trim();
  if (!desc) { toast("Description is required"); return; }

  try {
    await api.add({
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
