async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

async function verifyAuth() {
  try {
    await api("/api/me.php");
    return true;
  } catch {
    return false;
  }
}


function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const el = (id) => document.getElementById(id);

function showApp(isAuthed) {
  el("loginCard").hidden = isAuthed;
  el("appCard").hidden = !isAuthed;
}

function renderList(items) {
  const listEl = el("list");
  listEl.innerHTML = "";

  if (!items || !items.length) {
    listEl.innerHTML = "<p class='muted'>No sessions yet.</p>";
    return;
  }

  // 1) Sort newest first (defensive)
  const sorted = [...items].sort(
    (a, b) => b.session_date.localeCompare(a.session_date)
  );

  // 2) Take only last 5
  const recent = sorted.slice(0, 5);

  // 3) Render ONLY those 5 (with delete button)
  listEl.innerHTML = recent.map(x => `
    <div class="item sessionItem">
      <div class="itemTop">
        <div><b>${x.session_date}</b> — ${x.activity_type}</div>

        <div class="pillStack">
          <div class="pill">
            ${x.duration_minutes}m · E${x.energy_level} · ${x.session_emphasis}
          </div>

          <button
            class="pill pillDelete"
            data-uuid="${x.uuid}"
            title="Delete session"
          >
            Delete
          </button>
        </div>
      </div>


      <div class="notes">
        ${x.notes ? escapeHtml(x.notes) : "<span class='muted'>No notes</span>"}
      </div>
    </div>
  `).join("");

  // 4) Attach delete handlers
  listEl.querySelectorAll(".pillDelete").forEach(btn => {
    btn.onclick = async () => {
      const uuid = btn.dataset.uuid;
      if (!confirm("Delete this session?")) return;

      try {
        await api("/api/sessions.php", {
          method: "DELETE",
          body: JSON.stringify({ uuid })
        });
        await refresh();
      } catch {
        alert("Could not delete session.");
      }
    };
  });
}


function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

/* --------------------------------------------------
   Refresh guard (prevents double render)
   -------------------------------------------------- */

let isRefreshing = false;

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const items = await api("/api/sessions.php");
    renderList(items);
  } finally {
    isRefreshing = false;
  }
}

el("btnLogin").onclick = async () => {
  el("loginMsg").textContent = "";
  try {
    await api("/api/login.php", {
      method: "POST",
      body: JSON.stringify({ username: el("user").value.trim(), password: el("pass").value })
    });
    showApp(true);
    el("date").value = new Date().toISOString().slice(0, 10);
    await refresh();
  } catch (e) {
    el("loginMsg").textContent = "Login fejlede.";
  }
};

el("btnLogout").onclick = async () => {
  await api("/api/logout.php", { method: "POST", body: "{}" });
  showApp(false);
};

el("btnSave").onclick = async () => {
  el("saveMsg").textContent = "";
  const activity = el("activity").value;
  const duration = Number(el("duration").value);

  if (activity !== "rest" && duration < 5) {
    el("saveMsg").textContent = "Training sessions must be at least 5 minutes.";
    return;
  }

  const dateInput = el("date");

  // Read the raw value string, not valueAsDate
  //const dateStr = dateInput.value;
  dateInput.blur(); // force mobile picker to commit value
  const dateStr = dateInput.value.trim();

  // Defensive check
  if (!dateStr) {
    el("saveMsg").textContent = "Please select a date.";
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    el("saveMsg").textContent = "Invalid date format.";
    return;
  }


  const payload = {
    session_date: dateStr,
    activity_type: activity,
    duration_minutes: duration,
    energy_level: Number(el("energy").value),
    session_emphasis: el("emphasis").value,
    notes: el("notes").value || null,
    uuid: uuidv4()
  };



  try {
    await api("/api/sessions.php", { method: "POST", body: JSON.stringify(payload) });
    el("saveMsg").textContent = "Saved ✅";
    el("notes").value = "";
    await refresh();
  } catch (e) {
    el("saveMsg").textContent = "Kunne ikke gemme (tjek felter).";
  }
};

el("btnRefresh").onclick = refresh;

// --------------------------------------------------
// Initial auth check on page load
// --------------------------------------------------

(async () => {
  const authed = await verifyAuth();
  showApp(authed);

  if (authed) {
    el("date").value = new Date().toISOString().slice(0, 10);
    await refresh();
  }
})();

// Start state (ikke authed før login)
// showApp(false);
