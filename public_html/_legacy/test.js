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

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const el = (id) => document.getElementById(id);

el("btnLogin").onclick = async () => {
  try {
    const data = await api("/api/login.php", {
      method: "POST",
      body: JSON.stringify({
        username: el("user").value,
        password: el("pass").value
      })
    });
    el("msg").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    el("msg").textContent = String(e);
  }
};

el("btnPost").onclick = async () => {
  try {
    const payload = {
      session_date: el("date").value,
      activity_type: el("activity").value,
      duration_minutes: Number(el("duration").value),
      energy_level: Number(el("energy").value),
      session_emphasis: el("emphasis").value,
      notes: el("notes").value,
      uuid: uuidv4()
    };
    const data = await api("/api/sessions.php", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    el("msg").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    el("msg").textContent = String(e);
  }
};

el("btnGet").onclick = async () => {
  try {
    const data = await api("/api/sessions.php");
    el("out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    el("out").textContent = String(e);
  }
};
