let editingUuid = null;

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

(function initTheme() {
  const validThemes = ["light", "dark", "warm-dojo", "classic-95"];
  const saved = localStorage.getItem("theme");
  let theme;

  if (saved && validThemes.includes(saved)) {
    theme = saved;
  } else {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.documentElement.dataset.theme = theme;
  const sel = document.getElementById("themeSelect");
  if (sel) sel.value = theme;
})();


function showApp(isAuthed) {
  el("loginCard").hidden = isAuthed;
  el("appCard").hidden = !isAuthed;
}

/* --------------------------------------------------
   Day view
-------------------------------------------------- */

async function loadDayView() {
  const input = el("dayDate");
  if (!input || !input.value) return;

  const isoDate = input.valueAsDate
    ? input.valueAsDate.toISOString().slice(0, 10)
    : input.value;

  try {
    const items = await api(`/api/sessions.php?date=${isoDate}`);
    renderDayList(items);
  } catch {
    el("dayList").innerHTML = "<p class='muted'>Could not load day.</p>";
  }
}

function renderDayList(items) {
  const elDay = el("dayList");
  elDay.innerHTML = "";

  if (!items || !items.length) {
    elDay.innerHTML = "<p class='muted'>No sessions this day.</p>";
    return;
  }

  elDay.innerHTML = items.map(x =>
    editingUuid === x.uuid ? renderEditCard(x) : renderReadCard(x)
  ).join("");

  // enter edit mode
  elDay.querySelectorAll(".pillEdit").forEach(btn => {
    btn.onclick = () => {
      editingUuid = btn.dataset.uuid;
      renderDayList(items);
    };
  });

  // cancel edit
  elDay.querySelectorAll(".pillCancel").forEach(btn => {
    btn.onclick = () => {
      editingUuid = null;
      renderDayList(items);
    };
  });

  elDay.querySelectorAll(".rpeBtn").forEach(btn => {
    btn.onclick = () => {
      const parent = btn.closest(".rpeScale");
      const wasActive = btn.classList.contains("active");

      parent.querySelectorAll(".rpeBtn").forEach(b =>
        b.classList.remove("active")
      );

      if (!wasActive) {
        btn.classList.add("active");
      }
    };
  });


  // save edit
  elDay.querySelectorAll(".pillSave").forEach(btn => {
    btn.onclick = async () => {
      const card = btn.closest(".item");
      const uuid = btn.dataset.uuid;

      const rpeBtn = card.querySelector(".rpeBtn.active");

      const payload = {
        uuid,
        session_date: el("dayDate").value,
        activity_type: card.querySelector(".editActivity").value.trim(),
        duration_minutes: Number(card.querySelector(".editDuration").value),
        energy_level: Number(card.querySelector(".editEnergy").value),
        session_emphasis: card.querySelector(".editEmphasis").value.trim(),
        rpe: rpeBtn ? Number(rpeBtn.dataset.rpe) : null,
        notes: card.querySelector(".editNotes").value || null
      };

      try {
        await api("/api/sessions.php", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        editingUuid = null;
        await loadDayView();
        await refresh();
      } catch {
        alert("Could not save changes.");
      }
    };
  });

  // delete (from edit mode)
  elDay.querySelectorAll(".pillDelete").forEach(btn => {
    btn.onclick = async () => {
      const uuid = btn.dataset.uuid;
      if (!confirm("Delete this session?")) return;

      try {
        await api("/api/sessions.php", {
          method: "DELETE",
          body: JSON.stringify({ uuid })
        });
        editingUuid = null;
        await loadDayView();
        await refresh();
      } catch {
        alert("Could not delete session.");
      }
    };
  });
}

function renderReadCard(x) {
  return `
    <div class="item">
      <div class="itemTop">
        <div><b>${x.activity_type}</b></div>

        <div class="pillStack">
          <div class="pill">
            ${x.duration_minutes}m · E${x.energy_level} · ${x.session_emphasis}
          </div>
          <button class="pill pillEdit" data-uuid="${x.uuid}">Edit</button>
        </div>
      </div>

      <!-- RPE -->
      <div class="itemTop">
        <div class="muted">
          Effort: ${Number.isInteger(x.rpe) ? `RPE ${x.rpe}` : "—"}
        </div>
      </div>



      <div class="notes">
        ${x.notes ? escapeHtml(x.notes) : "<span class='muted'>No notes</span>"}
      </div>
    </div>
  `;
}

function renderEditCard(x) {
  return `
    <div class="item editing">
      <div class="itemTop">
        <select class="editActivity">
          ${activityOptions(x.activity_type)}
        </select>

        <input
          class="editDuration"
          type="number"
          min="0"
          max="300"
          value="${x.duration_minutes}"
        />
      </div>

      <div class="itemTop">
        <select class="editEnergy">
          ${energyOptions(x.energy_level)}
        </select>

        <select class="editEmphasis">
          ${emphasisOptions(x.session_emphasis)}
        </select>
      </div>

      <div class="itemTop rpeRow">
        <span class="muted">RPE</span>
        <div class="rpeScale">
          ${rpeOptions(x.rpe)}
        </div>
      </div>

      <textarea class="editNotes">${escapeHtml(x.notes || "")}</textarea>

      <div class="pillStack">
        <button class="pill pillSave" data-uuid="${x.uuid}">Save</button>
        <button class="pill pillDelete" data-uuid="${x.uuid}">Delete</button>
        <button class="pill pillCancel">Cancel</button>
      </div>
    </div>
  `;
}

function activityOptions(selected) {
  const activities = ["karate", "rowing", "run", "weights", "cardio", "rest"];
  return activities.map(a =>
    `<option value="${a}" ${a === selected ? "selected" : ""}>${a}</option>`
  ).join("");
}

function emphasisOptions(selected) {
  const opts = ["physical", "technical", "mixed"];
  return opts.map(o =>
    `<option value="${o}" ${o === selected ? "selected" : ""}>${o}</option>`
  ).join("");
}

function energyOptions(selected) {
  return [1, 2, 3, 4, 5].map(n =>
    `<option value="${n}" ${n === Number(selected) ? "selected" : ""}>${n}</option>`
  ).join("");
}

function rpeOptions(selected) {
  return Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const active = Number(selected) === n ? "active" : "";
    return `
      <button
        type="button"
        class="rpeBtn ${active}"
        data-rpe="${n}">
        ${n}
      </button>
    `;
  }).join("");
}

function initLogRpe() {
  const scale = el("logRpeScale");
  if (!scale) return;
  scale.innerHTML = rpeOptions(null);
  scale.querySelectorAll(".rpeBtn").forEach(btn => {
    btn.onclick = () => {
      const wasActive = btn.classList.contains("active");
      scale.querySelectorAll(".rpeBtn").forEach(b => b.classList.remove("active"));
      if (!wasActive) btn.classList.add("active");
    };
  });
}

function getLogRpe() {
  const active = document.querySelector("#logRpeScale .rpeBtn.active");
  return active ? Number(active.dataset.rpe) : null;
}

function resetLogRpe() {
  const scale = el("logRpeScale");
  if (scale) scale.querySelectorAll(".rpeBtn").forEach(b => b.classList.remove("active"));
}


/* --------------------------------------------------
   Recent list (unchanged, delete-only)
-------------------------------------------------- */

function renderList(items) {
  const listEl = el("list");
  listEl.innerHTML = "";

  if (!items || !items.length) {
    listEl.innerHTML = "<p class='muted'>No sessions yet.</p>";
    return;
  }

  const sorted = [...items].sort(
    (a, b) => b.session_date.localeCompare(a.session_date)
  );

  const recent = sorted.slice(0, 5);

  listEl.innerHTML = recent.map(x => `
    <div class="item sessionItem">
      <div class="itemTop">
        <div><b>${x.session_date}</b> — ${x.activity_type}</div>

        <div class="pillStack">
          <div class="pill">
            ${x.duration_minutes}m · E${x.energy_level} · ${x.session_emphasis}
            ${x.rpe ? ` · RPE ${x.rpe}` : ""}
          </div>
          <button class="pill pillDelete" data-uuid="${x.uuid}">Delete</button>
        </div>
      </div>

      <div class="notes">
        ${x.notes ? escapeHtml(x.notes) : "<span class='muted'>No notes</span>"}
      </div>
    </div>
  `).join("");

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
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

/* --------------------------------------------------
   Refresh
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

/* --------------------------------------------------
   Auth + init
-------------------------------------------------- */

el("btnLogin").onclick = async () => {
  el("loginMsg").textContent = "";
  try {
    await api("/api/login.php", {
      method: "POST",
      body: JSON.stringify({
        username: el("user").value.trim(),
        password: el("pass").value
      })
    });
    showApp(true);
    el("date").value = new Date().toISOString().slice(0, 10);
    initLogRpe();
    await refresh();
  } catch {
    el("loginMsg").textContent = "Login failed.";
  }
};

el("btnLogout").onclick = async () => {
  await api("/api/logout.php", { method: "POST", body: "{}" });
  showApp(false);
};

el("btnSave").onclick = async () => {
  el("saveMsg").textContent = "";

  const dateInput = el("date");
  dateInput.blur();
  const dateStr = dateInput.value.trim();

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    el("saveMsg").textContent = "Invalid date.";
    return;
  }

  const payload = {
    uuid: uuidv4(),
    session_date: dateStr,
    activity_type: el("activity").value,
    duration_minutes: Number(el("duration").value),
    energy_level: Number(el("energy").value),
    session_emphasis: el("emphasis").value,
    rpe: getLogRpe(),
    notes: el("notes").value || null
  };

  try {
    await api("/api/sessions.php", { method: "POST", body: JSON.stringify(payload) });
    el("saveMsg").textContent = "Saved ✅";
    el("notes").value = "";
    resetLogRpe();
    await refresh();
    await loadDayView();
  } catch {
    el("saveMsg").textContent = "Could not save.";
  }
};

el("btnRefresh").onclick = refresh;
el("btnDayView").onclick = loadDayView;

(async () => {
  const authed = await verifyAuth();
  showApp(authed);

  if (authed) {
    const today = new Date().toISOString().slice(0, 10);
    el("date").value = today;
    el("dayDate").value = today;
    initLogRpe();
    await refresh();
    await loadDayView();
  }
})();

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}
