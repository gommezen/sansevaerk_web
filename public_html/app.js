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

  // save edit
  elDay.querySelectorAll(".pillSave").forEach(btn => {
    btn.onclick = async () => {
      const card = btn.closest(".item");
      const uuid = btn.dataset.uuid;

      const payload = {
        uuid,
        session_date: el("dayDate").value,
        activity_type: card.querySelector(".editActivity").value.trim(),
        duration_minutes: Number(card.querySelector(".editDuration").value),
        energy_level: Number(card.querySelector(".editEnergy").value),
        session_emphasis: card.querySelector(".editEmphasis").value.trim(),
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
  const activities = ["karate", "row", "run", "weights", "cardio", "rest"];
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
    await refresh();
  } catch {
    el("loginMsg").textContent = "Login fejlede.";
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
    notes: el("notes").value || null
  };

  try {
    await api("/api/sessions.php", { method: "POST", body: JSON.stringify(payload) });
    el("saveMsg").textContent = "Saved ✅";
    el("notes").value = "";
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
    await refresh();
    await loadDayView();
  }
})();







































// let editingUuid = null;


// async function api(path, opts = {}) {
//   const res = await fetch(path, {
//     credentials: "include",
//     headers: { "Content-Type": "application/json" },
//     ...opts
//   });
//   const text = await res.text();
//   let data;
//   try { data = JSON.parse(text); } catch { data = text; }
//   if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
//   return data;
// }

// async function verifyAuth() {
//   try {
//     await api("/api/me.php");
//     return true;
//   } catch {
//     return false;
//   }
// }


// function uuidv4() {
//   return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
//     const r = (Math.random() * 16) | 0;
//     const v = c === "x" ? r : (r & 0x3) | 0x8;
//     return v.toString(16);
//   });
// }

// const el = (id) => document.getElementById(id);

// function showApp(isAuthed) {
//   el("loginCard").hidden = isAuthed;
//   el("appCard").hidden = !isAuthed;
// }

// // Load selected day overview
// async function loadDayView() {
//   const input = el("dayDate");
//   if (!input || !input.value) return;

//   // Normalize to YYYY-MM-DD regardless of locale
//   const isoDate = input.valueAsDate
//     ? input.valueAsDate.toISOString().slice(0, 10)
//     : input.value;

//   try {
//     const items = await api(`/api/sessions.php?date=${isoDate}`);
//     renderDayList(items);
//   } catch {
//     el("dayList").innerHTML = "<p class='muted'>Could not load day.</p>";
//   }
// }


// //render day view
// function renderDayList(items) {
//   const elDay = el("dayList");
//   elDay.innerHTML = "";

//   if (!items || !items.length) {
//     elDay.innerHTML = "<p class='muted'>No sessions this day.</p>";
//     return;
//   }

//   elDay.innerHTML = items.map(x => `
//     <div class="item">
//       <div class="itemTop">
//         <div><b>${x.activity_type}</b></div>

//         <div class="pillStack">
//           <div class="pill">
//             ${x.duration_minutes}m · E${x.energy_level} · ${x.session_emphasis}
//           </div>

//           <button
//             class="pill pillEdit"
//             data-uuid="${x.uuid}"
//           >
//             Edit
//           </button>

//         </div>
//       </div>

//       <div class="notes">
//         ${x.notes ? escapeHtml(x.notes) : "<span class='muted'>No notes</span>"}
//       </div>
//     </div>
//   `).join("");

//   // attach delete handlers (same logic as before)
//   elDay.querySelectorAll(".pillDelete").forEach(btn => {
//     btn.onclick = async () => {
//       const uuid = btn.dataset.uuid;
//       if (!confirm("Delete this session?")) return;

//       try {
//         await api("/api/sessions.php", {
//           method: "DELETE",
//           body: JSON.stringify({ uuid })
//         });
//         await loadDayView();   // refresh day
//         await refresh();       // refresh recent
//       } catch {
//         alert("Could not delete session.");
//       }
//     };
//   });
// }


// function renderList(items) {
//   const listEl = el("list");
//   listEl.innerHTML = "";

//   if (!items || !items.length) {
//     listEl.innerHTML = "<p class='muted'>No sessions yet.</p>";
//     return;
//   }

//   // 1) Sort newest first (defensive)
//   const sorted = [...items].sort(
//     (a, b) => b.session_date.localeCompare(a.session_date)
//   );

//   // 2) Take only last 5
//   const recent = sorted.slice(0, 5);

//   // 3) Render ONLY those 5 (with delete button)
//   listEl.innerHTML = recent.map(x => `
//     <div class="item sessionItem">
//       <div class="itemTop">
//         <div><b>${x.session_date}</b> — ${x.activity_type}</div>

//         <div class="pillStack">
//           <div class="pill">
//             ${x.duration_minutes}m · E${x.energy_level} · ${x.session_emphasis}
//           </div>

//           <button
//             class="pill pillDelete"
//             data-uuid="${x.uuid}"
//             title="Delete session"
//           >
//             Delete
//           </button>
//         </div>
//       </div>


//       <div class="notes">
//         ${x.notes ? escapeHtml(x.notes) : "<span class='muted'>No notes</span>"}
//       </div>
//     </div>
//   `).join("");

//   // 4) Attach delete handlers
//   listEl.querySelectorAll(".pillDelete").forEach(btn => {
//     btn.onclick = async () => {
//       const uuid = btn.dataset.uuid;
//       if (!confirm("Delete this session?")) return;

//       try {
//         await api("/api/sessions.php", {
//           method: "DELETE",
//           body: JSON.stringify({ uuid })
//         });
//         await refresh();
//       } catch {
//         alert("Could not delete session.");
//       }
//     };
//   });
// }


// function escapeHtml(s) {
//   return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
// }

// /* --------------------------------------------------
//    Refresh guard (prevents double render)
//    -------------------------------------------------- */

// let isRefreshing = false;

// async function refresh() {
//   if (isRefreshing) return;
//   isRefreshing = true;

//   try {
//     const items = await api("/api/sessions.php");
//     renderList(items);
//   } finally {
//     isRefreshing = false;
//   }
// }

// el("btnLogin").onclick = async () => {
//   el("loginMsg").textContent = "";
//   try {
//     await api("/api/login.php", {
//       method: "POST",
//       body: JSON.stringify({ username: el("user").value.trim(), password: el("pass").value })
//     });
//     showApp(true);
//     el("date").value = new Date().toISOString().slice(0, 10);
//     await refresh();
//   } catch (e) {
//     el("loginMsg").textContent = "Login fejlede.";
//   }
// };

// el("btnLogout").onclick = async () => {
//   await api("/api/logout.php", { method: "POST", body: "{}" });
//   showApp(false);
// };

// el("btnSave").onclick = async () => {
//   el("saveMsg").textContent = "";
//   const activity = el("activity").value;
//   const duration = Number(el("duration").value);

//   if (activity !== "rest" && duration < 5) {
//     el("saveMsg").textContent = "Training sessions must be at least 5 minutes.";
//     return;
//   }

//   const dateInput = el("date");

//   // Read the raw value string, not valueAsDate
//   //const dateStr = dateInput.value;
//   dateInput.blur(); // force mobile picker to commit value
//   const dateStr = dateInput.value.trim();

//   // Defensive check
//   if (!dateStr) {
//     el("saveMsg").textContent = "Please select a date.";
//     return;
//   }

//   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
//     el("saveMsg").textContent = "Invalid date format.";
//     return;
//   }


//   const payload = {
//     session_date: dateStr,
//     activity_type: activity,
//     duration_minutes: duration,
//     energy_level: Number(el("energy").value),
//     session_emphasis: el("emphasis").value,
//     notes: el("notes").value || null,
//     uuid: uuidv4()
//   };



//   try {
//     await api("/api/sessions.php", { method: "POST", body: JSON.stringify(payload) });
//     el("saveMsg").textContent = "Saved ✅";
//     el("notes").value = "";
//     await refresh();
//   } catch (e) {
//     el("saveMsg").textContent = "Kunne ikke gemme (tjek felter).";
//   }
// };

// el("btnRefresh").onclick = refresh;

// el("btnDayView").onclick = loadDayView;


// // --------------------------------------------------
// // Initial auth check on page load
// // --------------------------------------------------

// // (async () => {
// //   const authed = await verifyAuth();
// //   showApp(authed);

// //   if (authed) {
// //     el("date").value = new Date().toISOString().slice(0, 10);
// //     await refresh();
// //   }
// // })();

// (async () => {
//   const authed = await verifyAuth();
//   showApp(authed);

//   if (authed) {
//     const today = new Date().toISOString().slice(0, 10);

//     // set form date
//     el("date").value = today;

//     // set day overview date
//     el("dayDate").value = today;

//     // load data
//     await refresh();
//     await loadDayView();
//   }
// })();



// // Start state (ikke authed før login)
// // showApp(false);
