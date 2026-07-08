const API_BASE = "frontend URL";
 
const state = {
  students: [],
  session: null,
  history: JSON.parse(localStorage.getItem("attendance_history") || "[]")
};
 
const refs = {
  sessionForm: document.getElementById("sessionForm"),
  className: document.getElementById("className"),
  attendanceDate: document.getElementById("attendanceDate"),
  teacherName: document.getElementById("teacherName"),
  sessionInfo: document.getElementById("sessionInfo"),
  addStudentBtn: document.getElementById("addStudentBtn"),
  addStudentForm: document.getElementById("addStudentForm"),
  studentName: document.getElementById("studentName"),
  studentId: document.getElementById("studentId"),
  studentList: document.getElementById("studentList"),
  statTotal: document.getElementById("statTotal"),
  statPresent: document.getElementById("statPresent"),
  statAbsent: document.getElementById("statAbsent"),
  statLate: document.getElementById("statLate"),
  saveRecordBtn: document.getElementById("saveRecordBtn"),
  historyBody: document.getElementById("historyBody"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  studentRowTemplate: document.getElementById("studentRowTemplate")
};
 
function formatDate(dateText) {
  if (!dateText) return "-";
  const date = new Date(dateText + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
 
function persistHistory() {
  localStorage.setItem("attendance_history", JSON.stringify(state.history));
}
 
function ensureSessionStatuses() {
  if (!state.session) return;
  for (const student of state.students) {
    if (!state.session.statusByStudentId[student.id]) {
      state.session.statusByStudentId[student.id] = "absent";
    }
  }
}
 
function renderSessionInfo() {
  if (!state.session) {
    refs.sessionInfo.textContent = "No active session";
    return;
  }
  refs.sessionInfo.textContent = `${state.session.className} | ${formatDate(state.session.date)} | ${state.session.teacher}`;
}
 
function updateStats() {
  refs.statTotal.textContent = String(state.students.length);
  if (!state.session) {
    refs.statPresent.textContent = "0";
    refs.statAbsent.textContent = "0";
    refs.statLate.textContent = "0";
    return;
  }
  let present = 0;
  let absent = 0;
  let late = 0;
  for (const student of state.students) {
    const status = state.session.statusByStudentId[student.id] || "absent";
    if (status === "present") present += 1;
    else if (status === "late") late += 1;
    else absent += 1;
  }
  refs.statPresent.textContent = String(present);
  refs.statAbsent.textContent = String(absent);
  refs.statLate.textContent = String(late);
}
 
async function setStudentStatus(studentId, status) {
  if (!state.session) {
    alert("Start a session first.");
    return;
  }
 
  const previousStatus = state.session.statusByStudentId[studentId] || "absent";
  // Update the UI immediately, then confirm with the backend.
  state.session.statusByStudentId[studentId] = status;
  renderStudentList();
 
  try {
    const response = await fetch(`${API_BASE}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.session.id,
        student_id: studentId,
        status
      })
    });
    if (!response.ok) throw new Error("Request failed");
  } catch (err) {
    // Roll back if the backend didn't accept it.
    state.session.statusByStudentId[studentId] = previousStatus;
    renderStudentList();
    alert("Could not save that attendance mark. Check that the server is running.");
  }
}
 
function renderStudentList() {
  refs.studentList.innerHTML = "";
  if (state.students.length === 0) {
    refs.studentList.innerHTML = "<p>No students yet. Add students to begin.</p>";
    updateStats();
    return;
  }
 
  ensureSessionStatuses();
  for (const student of state.students) {
    const node = refs.studentRowTemplate.content.firstElementChild.cloneNode(true);
    const title = node.querySelector(".student-title");
    const subtitle = node.querySelector(".student-subtitle");
    const statusButtons = node.querySelectorAll("[data-status]");
    const status = state.session?.statusByStudentId[student.id] || "absent";
 
    title.textContent = student.name;
    subtitle.textContent = `Roll: ${student.roll}`;
 
    statusButtons.forEach((button) => {
      if (button.dataset.status === status) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => setStudentStatus(student.id, button.dataset.status));
    });
 
    refs.studentList.appendChild(node);
  }
  updateStats();
}
 
function renderHistory() {
  refs.historyBody.innerHTML = "";
  if (state.history.length === 0) {
    refs.historyBody.innerHTML = `
      <tr>
        <td colspan="6">No attendance records yet.</td>
      </tr>
    `;
    return;
  }
 
  const records = [...state.history].reverse();
  for (const record of records) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(record.date)}</td>
      <td>${record.className}</td>
      <td>${record.teacher}</td>
      <td>${record.present}</td>
      <td>${record.absent}</td>
      <td>${record.late}</td>
    `;
    refs.historyBody.appendChild(row);
  }
}
 
async function startSession(event) {
  event.preventDefault();
 
  const response = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      class_name: refs.className.value,
      teacher_name: refs.teacherName.value
    })
  });
 
  if (!response.ok) {
    alert("Could not start the session. Check that the server is running.");
    return;
  }
 
  const data = await response.json();
 
  state.session = {
    id: data.session_id,
    className: refs.className.value,
    date: refs.attendanceDate.value,
    teacher: refs.teacherName.value,
    statusByStudentId: {}
  };
 
  renderSessionInfo();
  renderStudentList();
}
 
async function addStudent(event) {
  event.preventDefault();
 
  const response = await fetch(`${API_BASE}/student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_roll: Number(refs.studentId.value),
      student_name: refs.studentName.value
    })
  });
 
  const data = await response.json();
  alert(data.message);
 
  refs.addStudentForm.reset();
  refs.addStudentForm.classList.add("hidden");
  await loadStudents();
}
 
async function loadStudents() {
  const response = await fetch(`${API_BASE}/students`);
  const students = await response.json();
 
  state.students = students.map((student) => ({
    id: student.id,           // real DB id — used for attendance foreign keys
    roll: student.student_roll,
    name: student.student_name
  }));
 
  renderStudentList();
}
 
async function saveSessionRecord() {
  if (!state.session) {
    alert("Start a session first.");
    return;
  }
 
  let counts = { present: 0, absent: 0, late: 0 };
 
  try {
    const response = await fetch(`${API_BASE}/attendance/session/${state.session.id}`);
    const records = await response.json();
 
    const recordedIds = new Set();
    for (const record of records) {
      counts[record.status] = (counts[record.status] || 0) + 1;
      recordedIds.add(record.student_id);
    }
    // Anyone never marked defaults to absent.
    for (const student of state.students) {
      if (!recordedIds.has(student.id)) counts.absent += 1;
    }
  } catch (err) {
    // Backend unreachable — fall back to what's on screen.
    for (const student of state.students) {
      const status = state.session.statusByStudentId[student.id] || "absent";
      counts[status] += 1;
    }
  }
 
  state.history.push({
    date: state.session.date,
    className: state.session.className,
    teacher: state.session.teacher,
    ...counts
  });
  persistHistory();
  renderHistory();
  alert("Attendance record saved.");
}
 
function clearHistory() {
  if (!confirm("Clear all attendance history?")) return;
  state.history = [];
  persistHistory();
  renderHistory();
}
 
function init() {
  refs.attendanceDate.valueAsDate = new Date();
  refs.sessionForm.addEventListener("submit", startSession);
  refs.addStudentForm.addEventListener("submit", addStudent);
  refs.addStudentBtn.addEventListener("click", () => {
    refs.addStudentForm.classList.toggle("hidden");
  });
  refs.saveRecordBtn.addEventListener("click", saveSessionRecord);
  refs.clearHistoryBtn.addEventListener("click", clearHistory);
  renderSessionInfo();
  loadStudents();
  renderHistory();
}
 
init();
 
