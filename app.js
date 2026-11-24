const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_START = 9;  // 9:00 AM
const DAY_END = 17;   // 5:00 PM

let machines = {
  Microscope: { working: true },
  Centrifuge: { working: true },
  Spectrophotometer: { working: true }
};

let requests = [
  {
    id: 1,
    role: "student",
    name: "Tanvir (Samples expire Thu)",
    machine: "Microscope",
    duration: 3,
    preferredDay: "Tuesday",
    urgency: 3,
    notes: "Samples expire Thursday - cannot move",
    overruled: false
  },
  {
    id: 2,
    role: "student",
    name: "Nadia",
    machine: "Centrifuge",
    duration: 1,
    preferredDay: "Any",
    urgency: 1,
    notes: "20-60 mins, not urgent",
    overruled: false
  },
  {
    id: 3,
    role: "student",
    name: "Rafiq (Thesis Next Week)",
    machine: "Microscope",
    duration: 3,
    preferredDay: "Tuesday",
    urgency: 3,
    notes: "Submission next week",
    overruled: false
  },
  {
    id: 4,
    role: "haque",
    name: "Dr. Haque (Personal Research)",
    machine: "Microscope",
    duration: 2,
    preferredDay: "Wednesday",
    urgency: 4,
    notes: "Admin priority override",
    overruled: true
  }
];

function formatTime(hourFloat) {
  const hrs = Math.floor(hourFloat);
  const mins = Math.round((hourFloat - hrs) * 60);
  const suffix = hrs >= 12 ? "PM" : "AM";
  const displayHr = hrs > 12 ? hrs - 12 : hrs;
  return `${displayHr}:${mins === 0 ? "00" : mins} ${suffix}`;
}

// Core Scheduling Algorithm
function generateSchedule() {
  const alerts = [];

  // Sort by Priority: Overruled/Dr. Haque > Critical Urgency > Preferred Day > FIFO
  const sorted = [...requests].sort((a, b) => {
    if (a.overruled !== b.overruled) return b.overruled - a.overruled;
    if (a.urgency !== b.urgency) return b.urgency - a.urgency;
    if ((a.preferredDay !== "Any") !== (b.preferredDay !== "Any")) {
      return (b.preferredDay !== "Any") - (a.preferredDay !== "Any");
    }
    return a.id - b.id;
  });

  // Track occupied intervals per machine per day: occupied[machine][day] = [[start, end], ...]
  const occupied = {};
  Object.keys(machines).forEach(m => {
    occupied[m] = {};
    DAYS.forEach(d => (occupied[m][d] = []));
  });

  sorted.forEach(req => {
    req.assignedSlot = null;

    if (!machines[req.machine].working) {
      alerts.push(`⚠️ ${req.machine} is OUT OF SERVICE. ${req.name}'s request (${req.duration}h) is deferred to next week.`);
      return;
    }

    // Determine candidate days (preferred day first, then fallback to other days)
    const candidateDays =
      req.preferredDay !== "Any"
        ? [req.preferredDay, ...DAYS.filter(d => d !== req.preferredDay)]
        : [...DAYS];

    for (const day of candidateDays) {
      const slots = occupied[req.machine][day].sort((a, b) => a[0] - b[0]);
      let pointer = DAY_START;

      for (const [start, end] of slots) {
        if (pointer + req.duration <= start) {
          break;
        }
        pointer = Math.max(pointer, end);
      }

      if (pointer + req.duration <= DAY_END) {
        occupied[req.machine][day].push([pointer, pointer + req.duration]);
        req.assignedSlot = {
          day,
          start: pointer,
          end: pointer + req.duration
        };
        if (req.preferredDay !== "Any" && req.preferredDay !== day) {
          alerts.push(`ℹ️ Moved ${req.name} from ${req.preferredDay} to ${day} due to higher-priority booking.`);
        }
        break;
      }
    }

    if (!req.assignedSlot) {
      alerts.push(`❌ Could not fit ${req.name} (${req.machine}, ${req.duration}h) this week — queued for Monday next week.`);
    }
  });

  renderAll(alerts);
}

function renderAll(alerts) {
  // 1. Render Machine Controls
  const machineDiv = document.getElementById("machine-controls");
  machineDiv.innerHTML = "";
  Object.entries(machines).forEach(([name, info]) => {
    const item = document.createElement("div");
    item.className = "machine-item";
    item.innerHTML = `
      <div>
        <strong>${name}</strong><br/>
        <span class="${info.working ? "status-ok" : "status-down"}">
          ${info.working ? "● Operational" : "● Out of Service"}
        </span>
      </div>
      <button class="btn-secondary" onclick="toggleMachine('${name}')">
        ${info.working ? "Mark Broken" : "Restore"}
      </button>
    `;
    machineDiv.appendChild(item);
  });

  // 2. Render Alerts
  const alertDiv = document.getElementById("alerts");
  alertDiv.innerHTML = alerts.length
    ? `<div class="alert-box">${[...new Set(alerts)].join("<br/>")}</div>`
    : "";

  // 3. Render Weekly Board
  const board = document.getElementById("schedule-board");
  board.innerHTML = "";
  DAYS.forEach(day => {
    const col = document.createElement("div");
    col.className = "day-col";
    col.innerHTML = `<h3>${day}</h3>`;

    const dayBookings = requests
      .filter(r => r.assignedSlot && r.assignedSlot.day === day)
      .sort((a, b) => a.assignedSlot.start - b.assignedSlot.start);

    if (dayBookings.length === 0) {
      col.innerHTML += `<p style="font-size:0.8rem;color:#9ca3af;text-align:center;">No bookings</p>`;
    }

    dayBookings.forEach(b => {
      const cardClass = b.role === "haque" || b.overruled ? "haque" : b.urgency === 3 ? "urgent" : "";
      col.innerHTML += `
        <div class="slot-card ${cardClass}">
          <strong>${b.machine}</strong><br/>
          ${formatTime(b.assignedSlot.start)} – ${formatTime(b.assignedSlot.end)}<br/>
          <span>${b.name}</span>
        </div>
      `;
    });

    board.appendChild(col);
  });

  // 4. Render Table
  const tbody = document.getElementById("request-table");
  tbody.innerHTML = "";
  requests.forEach(r => {
    const slotText = r.assignedSlot
      ? `${r.assignedSlot.day} (${formatTime(r.assignedSlot.start)} - ${formatTime(r.assignedSlot.end)})`
      : "Deferred / Next Week";

    const urgencyLabel =
      r.role === "haque" || r.overruled
        ? "⭐ Dr. Haque Override"
        : r.urgency === 3
        ? "🔴 Critical"
        : r.urgency === 2
        ? "🟡 Medium"
        : "🟢 Flexible";

    tbody.innerHTML += `
      <tr>
        <td><strong>${r.name}</strong><br/><small>${r.notes || ""}</small></td>
        <td>${r.machine}</td>
        <td>${r.duration} hrs</td>
        <td>${urgencyLabel}</td>
        <td>${slotText}</td>
        <td>
          <button class="btn-secondary" onclick="toggleOverrule(${r.id})">
            ${r.overruled ? "Undo Overrule" : "Dr. Haque Overrule"}
          </button>
          <button class="btn-secondary" style="color:#dc2626;" onclick="deleteRequest(${r.id})">✕</button>
        </td>
      </tr>
    `;
  });
}

window.toggleMachine = function (name) {
  machines[name].working = !machines[name].working;
  generateSchedule();
};

window.toggleOverrule = function (id) {
  const req = requests.find(r => r.id === id);
  if (req) req.overruled = !req.overruled;
  generateSchedule();
};

window.deleteRequest = function (id) {
  requests = requests.filter(r => r.id !== id);
  generateSchedule();
};

document.getElementById("request-form").addEventListener("submit", e => {
  e.preventDefault();
  const role = document.getElementById("role").value;
  requests.push({
    id: Date.now(),
    role,
    name: document.getElementById("name").value.trim(),
    machine: document.getElementById("machine").value,
    duration: parseFloat(document.getElementById("duration").value),
    preferredDay: document.getElementById("preferred-day").value,
    urgency: role === "haque" ? 4 : parseInt(document.getElementById("urgency").value, 10),
    notes: document.getElementById("notes").value.trim(),
    overruled: role === "haque"
  });
  e.target.reset();
  generateSchedule();
});

document.getElementById("reset-demo").addEventListener("click", () => {
  location.reload();
});

// Initial Run
generateSchedule();