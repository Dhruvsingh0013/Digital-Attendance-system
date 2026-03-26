const state = {
  students: JSON.parse(localStorage.getItem("attendance_students") || "[]"),
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

function persistStudents() {
  localStorage.setItem("attendance_students", JSON.stringify(state.students));
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

function setStudentStatus(studentId, status) {
  if (!state.session) return;
  state.session.statusByStudentId[studentId] = status;
  renderStudentList();
  updateStats();
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
    subtitle.textContent = `ID: ${student.id}`;

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

function getSessionCounts() {
  const counts = { present: 0, absent: 0, late: 0 };
  for (const student of state.students) {
    const status = state.session.statusByStudentId[student.id] || "absent";
    counts[status] += 1;
  }
  return counts;
}

function startSession(event) {
  event.preventDefault();
  state.session = {
    className: refs.className.value.trim(),
    date: refs.attendanceDate.value,
    teacher: refs.teacherName.value.trim(),
    statusByStudentId: {}
  };
  ensureSessionStatuses();
  renderSessionInfo();
  renderStudentList();
}

function addStudent(event) {
  event.preventDefault();
  const name = refs.studentName.value.trim();
  const id = refs.studentId.value.trim();
  if (!name || !id) return;

  const duplicate = state.students.some((student) => student.id.toLowerCase() === id.toLowerCase());
  if (duplicate) {
    alert("Student ID already exists.");
    return;
  }

  state.students.push({ name, id });
  persistStudents();
  refs.addStudentForm.reset();
  if (state.session) {
    state.session.statusByStudentId[id] = "absent";
  }
  renderStudentList();
}

function saveSessionRecord() {
  if (!state.session) {
    alert("Start a session first.");
    return;
  }
  const counts = getSessionCounts();
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
  renderStudentList();
  renderHistory();
}

init();
