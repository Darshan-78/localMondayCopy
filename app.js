"use strict";

const STORAGE_KEY = "studyspace.tasks.v1";
const DASHBOARD_STORAGE_KEY = "studyspace.dashboard.v1";
const DEFAULT_STUDENT_ID = "";

const today = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};
const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const ATTENDANCE_SEEDS = {
  "student-001": [
    { name: "Biology", attended: 9, total: 12 },
    { name: "History", attended: 11, total: 14 },
    { name: "Calculus", attended: 13, total: 16 },
    { name: "Chemistry", attended: 8, total: 11 }
  ],
  "student-002": [
    { name: "Literature", attended: 10, total: 13 },
    { name: "Spanish", attended: 8, total: 12 },
    { name: "Physics", attended: 11, total: 15 },
    { name: "Computer Applications", attended: 9, total: 12 }
  ],
  "student-003": [
    { name: "Chemistry", attended: 12, total: 15 },
    { name: "Algebra", attended: 10, total: 13 },
    { name: "Economics", attended: 9, total: 12 },
    { name: "Art", attended: 8, total: 11 }
  ],
  "student-004": [
    { name: "Computer Networks", attended: 11, total: 14 },
    { name: "Psychology", attended: 9, total: 13 },
    { name: "Programming", attended: 12, total: 16 },
    { name: "Communication Skills", attended: 7, total: 12 }
  ]
};
const MARKS_SEEDS = {
  "student-001": [
    { subject: "Biology", marks: 87, maximum: 100 },
    { subject: "History", marks: 91, maximum: 100 },
    { subject: "Calculus", marks: 78, maximum: 100 },
    { subject: "Chemistry", marks: 84, maximum: 100 }
  ],
  "student-002": [
    { subject: "Literature", marks: 89, maximum: 100 },
    { subject: "Spanish", marks: 76, maximum: 100 },
    { subject: "Physics", marks: 82, maximum: 100 },
    { subject: "Computer Applications", marks: 94, maximum: 100 }
  ],
  "student-003": [
    { subject: "Chemistry", marks: 92, maximum: 100 },
    { subject: "Algebra", marks: 85, maximum: 100 },
    { subject: "Economics", marks: 79, maximum: 100 },
    { subject: "Art", marks: 96, maximum: 100 }
  ],
  "student-004": [
    { subject: "Computer Networks", marks: 83, maximum: 100 },
    { subject: "Psychology", marks: 90, maximum: 100 },
    { subject: "Programming", marks: 95, maximum: 100 },
    { subject: "Communication Skills", marks: 78, maximum: 100 }
  ]
};
let dashboardNeedsSave = false;

function summarizeAttendance(subjects) {
  return subjects.reduce((total, subject) => ({
    attended: total.attended + subject.attended,
    total: total.total + subject.total
  }), { attended: 0, total: 0 });
}

function ensureStudentMarks(student) {
  if (!student || typeof student !== "object") return;
  const seeds = MARKS_SEEDS[student.id];
  if (!seeds) return;

  const savedMarks = Array.isArray(student.marks) ? student.marks : [];
  const savedBySubject = new Map();
  savedMarks.forEach((record) => {
    if (!record || typeof record.subject !== "string" ||
      !Number.isFinite(record.marks) ||
      !Number.isFinite(record.maximum) ||
      record.maximum <= 0 ||
      record.marks < 0 ||
      record.marks > record.maximum ||
      !seeds.some((seed) => seed.subject === record.subject)) return;
    savedBySubject.set(record.subject, {
      subject: record.subject,
      marks: record.marks,
      maximum: record.maximum
    });
  });

  const marks = seeds.map((seed) => savedBySubject.get(seed.subject) || { ...seed });
  if (JSON.stringify(student.marks) !== JSON.stringify(marks)) {
    student.marks = marks;
    dashboardNeedsSave = true;
  }
}

function migrateStudentAttendance(student) {
  if (!student || typeof student !== "object") return;
  const seeds = ATTENDANCE_SEEDS[student.id];
  if (!seeds) return;

  const savedAttendance = student.attendance && typeof student.attendance === "object"
    ? student.attendance
    : {};
  const savedSubjects = Array.isArray(savedAttendance.subjects) ? savedAttendance.subjects : [];
  const oldSubjectAliases = {
    "student-001": { mathematics: "Calculus" },
    "student-003": { mathematics: "Algebra" },
    "student-004": { "computer science": "Computer Networks" }
  };
  const aliases = oldSubjectAliases[student.id] || {};
  const savedByName = new Map();
  const archivedByName = new Map();

  (Array.isArray(savedAttendance.previousSubjects) ? savedAttendance.previousSubjects : []).forEach((subject) => {
    if (!subject || typeof subject.name !== "string") return;
    const name = aliases[subject.name.toLocaleLowerCase()] || subject.name;
    const isValid = Number.isInteger(subject.attended) &&
      Number.isInteger(subject.total) &&
      subject.total > 0 &&
      subject.attended >= 0 &&
      subject.attended <= subject.total;
    if (!isValid) return;

    if (seeds.some((seed) => seed.name === name) && !savedByName.has(name)) {
      savedByName.set(name, { name, attended: subject.attended, total: subject.total });
    } else if (!seeds.some((seed) => seed.name === name)) {
      archivedByName.set(subject.name.toLocaleLowerCase(), {
        name: subject.name,
        attended: subject.attended,
        total: subject.total
      });
    }
  });

  savedSubjects.forEach((subject) => {
    if (!subject || typeof subject.name !== "string") return;
    const name = aliases[subject.name.toLocaleLowerCase()] || subject.name;
    const isValid = Number.isInteger(subject.attended) &&
      Number.isInteger(subject.total) &&
      subject.total > 0 &&
      subject.attended >= 0 &&
      subject.attended <= subject.total;
    if (!isValid) return;

    if (seeds.some((seed) => seed.name === name)) {
      savedByName.set(name, { name, attended: subject.attended, total: subject.total });
    } else {
      archivedByName.set(subject.name.toLocaleLowerCase(), {
        name: subject.name,
        attended: subject.attended,
        total: subject.total
      });
    }
  });

  const subjects = seeds.map((seed) => savedByName.get(seed.name) || { ...seed });
  const updatedAttendance = {
    overall: summarizeAttendance(subjects),
    subjects,
    previousSubjects: [...archivedByName.values()],
    ...(Array.isArray(savedAttendance.history) ? { history: savedAttendance.history } : {}),
    ...(typeof savedAttendance.historyIsDemo === "boolean" ? { historyIsDemo: savedAttendance.historyIsDemo } : {})
  };

  if (JSON.stringify(student.attendance) !== JSON.stringify(updatedAttendance)) {
    student.attendance = updatedAttendance;
    dashboardNeedsSave = true;
  }
}

function generateAttendanceHistory(student) {
  const currentDate = today();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();
  const semesterStart = month > 7 || (month === 7 && day >= 24)
    ? new Date(currentDate.getFullYear(), 7, 24)
    : new Date(currentDate.getFullYear(), 0, 12);
  const studentIndex = Math.max(0, Object.keys(ATTENDANCE_SEEDS).indexOf(student.id));
  const subjects = student.attendance.subjects;
  const history = [];

  subjects.forEach((subject, subjectIndex) => {
    const weekdays = [
      (studentIndex + subjectIndex) % 5,
      (studentIndex + subjectIndex + 2) % 5,
      (studentIndex + subjectIndex + 4) % 5
    ];
    const classDates = [];
    const date = new Date(semesterStart);

    while (date <= currentDate) {
      if (weekdays.includes(date.getDay())) classDates.push(dateKey(date));
      date.setDate(date.getDate() + 1);
    }

    const selectedDates = classDates.slice(-subject.total);
    for (let index = 0; index < selectedDates.length; index += 1) {
      const isPresent = Math.floor((index + 1) * subject.attended / subject.total) >
        Math.floor(index * subject.attended / subject.total);
      history.push({
        id: `${student.id}-${subjectIndex}-${selectedDates[index]}`,
        subject: subject.name,
        date: selectedDates[index],
        status: isPresent ? "Present" : "Absent"
      });
    }
  });

  return history.sort((first, second) => first.date.localeCompare(second.date));
}

function ensureAttendanceHistory(student) {
  if (!student.attendance || !Array.isArray(student.attendance.subjects)) return;

  const subjects = student.attendance.subjects;
  const history = student.attendance.history;
  const expectedCount = subjects.reduce((total, subject) => total + subject.total, 0);
  const validRecords = Array.isArray(history) &&
    history.length === expectedCount &&
    history.every((record) =>
      record &&
      subjects.some((subject) => subject.name === record.subject) &&
      /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
      (record.status === "Present" || record.status === "Absent"));
  const countsMatch = validRecords && subjects.every((subject) => {
    const subjectRecords = history.filter((record) => record.subject === subject.name);
    return subjectRecords.length === subject.total &&
      subjectRecords.filter((record) => record.status === "Present").length === subject.attended &&
      subjectRecords.filter((record) => record.status === "Absent").length === subject.total - subject.attended;
  });

  if (!countsMatch || student.attendance.historyIsDemo !== true) {
    student.attendance.history = countsMatch ? history : generateAttendanceHistory(student);
    student.attendance.historyIsDemo = true;
    dashboardNeedsSave = true;
  }
}

const initialTasks = () => {
  const day = today();
  const addDays = (amount) => {
    const date = new Date(day);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  };
  return [
    { id: "sample-bio", title: "Finish biology lab report", description: "Write up the results and double-check the conclusion before submitting.", dueDate: addDays(0), priority: "high", completed: false, createdAt: Date.now() - 5000 },
    { id: "sample-history", title: "Read chapter 8 for history", description: "Take a few notes on the causes of the industrial revolution.", dueDate: addDays(1), priority: "medium", completed: false, createdAt: Date.now() - 4000 },
    { id: "sample-math", title: "Complete calculus problem set", description: "Focus on exercises 4–12 from the integration worksheet.", dueDate: addDays(2), priority: "high", completed: false, createdAt: Date.now() - 3000 },
    { id: "sample-essay", title: "Outline literature essay", description: "Gather a couple of quotes to support the main argument.", dueDate: addDays(4), priority: "low", completed: false, createdAt: Date.now() - 2000 },
    { id: "sample-notes", title: "Organize chemistry notes", description: "Review this week’s lecture notes and highlight key terms.", dueDate: addDays(-1), priority: "medium", completed: true, createdAt: Date.now() - 1000 }
  ];
};

const demoStudentData = () => {
  const day = today();
  const dateFromToday = (offset) => {
    const date = new Date(day);
    date.setDate(date.getDate() + offset);
    return dateKey(date);
  };

  return {
    currentStudentId: DEFAULT_STUDENT_ID,
    isAuthenticated: false,
    students: [
      {
        id: "student-001",
        name: "Alice Johnson",
        username: "alice",
        password: "student123",
        tasks: [
          { id: "alice-task-1", title: "Submit biology lab report", description: "Attach final observations and conclusion.", dueDate: dateFromToday(0), priority: "high", completed: false, createdAt: Date.now() - 7000 },
          { id: "alice-task-2", title: "Read chapter 8 for history", description: "Take notes on the industrial revolution causes.", dueDate: dateFromToday(1), priority: "medium", completed: false, createdAt: Date.now() - 6000 },
          { id: "alice-task-3", title: "Complete calculus worksheet", description: "Finish questions 4 to 12 before class.", dueDate: dateFromToday(2), priority: "high", completed: false, createdAt: Date.now() - 5000 },
          { id: "alice-task-4", title: "Review chemistry notes", description: "Highlight key terms and formulas for the quiz.", dueDate: dateFromToday(-1), priority: "medium", completed: true, createdAt: Date.now() - 4000 }
        ],
        attendance: { overall: summarizeAttendance(ATTENDANCE_SEEDS["student-001"]), subjects: ATTENDANCE_SEEDS["student-001"].map((subject) => ({ ...subject })), previousSubjects: [] }
      },
      {
        id: "student-002",
        name: "Daniel Kim",
        username: "daniel",
        password: "student123",
        tasks: [
          { id: "daniel-task-1", title: "Outline literature essay", description: "Collect quotes and structure the argument.", dueDate: dateFromToday(3), priority: "low", completed: false, createdAt: Date.now() - 7000 },
          { id: "daniel-task-2", title: "Practice Spanish vocabulary", description: "Review chapters 3 and 4 before Friday.", dueDate: dateFromToday(4), priority: "medium", completed: false, createdAt: Date.now() - 6000 },
          { id: "daniel-task-3", title: "Finish physics questions", description: "Complete the motion problems and check units.", dueDate: dateFromToday(1), priority: "high", completed: true, createdAt: Date.now() - 5000 },
          { id: "daniel-task-4", title: "Organize project files", description: "Put notes and references into one folder.", dueDate: dateFromToday(-2), priority: "low", completed: true, createdAt: Date.now() - 4000 }
        ],
        attendance: { overall: summarizeAttendance(ATTENDANCE_SEEDS["student-002"]), subjects: ATTENDANCE_SEEDS["student-002"].map((subject) => ({ ...subject })), previousSubjects: [] }
      },
      {
        id: "student-003",
        name: "Priya Sharma",
        username: "priya",
        password: "student123",
        tasks: [
          { id: "priya-task-1", title: "Prepare chemistry presentation", description: "Summarize the experiment and main conclusions.", dueDate: dateFromToday(0), priority: "high", completed: false, createdAt: Date.now() - 7000 },
          { id: "priya-task-2", title: "Finish algebra practice set", description: "Work on equations from the latest worksheet.", dueDate: dateFromToday(2), priority: "medium", completed: false, createdAt: Date.now() - 6000 },
          { id: "priya-task-3", title: "Review economics notes", description: "Highlight definitions and examples for revision.", dueDate: dateFromToday(5), priority: "low", completed: false, createdAt: Date.now() - 5000 },
          { id: "priya-task-4", title: "Submit art critique draft", description: "Check the introduction and supporting evidence.", dueDate: dateFromToday(-1), priority: "medium", completed: true, createdAt: Date.now() - 4000 }
        ],
        attendance: { overall: summarizeAttendance(ATTENDANCE_SEEDS["student-003"]), subjects: ATTENDANCE_SEEDS["student-003"].map((subject) => ({ ...subject })), previousSubjects: [] }
      },
      {
        id: "student-004",
        name: "Marcus Lee",
        username: "marcus",
        password: "student123",
        tasks: [
          { id: "marcus-task-1", title: "Update computer science project", description: "Finish the user interface and test the flow.", dueDate: dateFromToday(1), priority: "high", completed: false, createdAt: Date.now() - 7000 },
          { id: "marcus-task-2", title: "Read psychology chapter", description: "Write a short summary of the key ideas.", dueDate: dateFromToday(2), priority: "medium", completed: false, createdAt: Date.now() - 6000 },
          { id: "marcus-task-3", title: "Practice coding exercises", description: "Repeat the array and loops questions.", dueDate: dateFromToday(4), priority: "high", completed: false, createdAt: Date.now() - 5000 },
          { id: "marcus-task-4", title: "Review group presentation", description: "Check timing and the final slide deck.", dueDate: dateFromToday(-3), priority: "low", completed: true, createdAt: Date.now() - 4000 }
        ],
        attendance: { overall: summarizeAttendance(ATTENDANCE_SEEDS["student-004"]), subjects: ATTENDANCE_SEEDS["student-004"].map((subject) => ({ ...subject })), previousSubjects: [] }
      }
    ]
  };
};

function loadDashboardData() {
  const stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);

  if (stored === null) {
    const firstDashboard = demoStudentData();
    firstDashboard.students.forEach((student) => {
      migrateStudentAttendance(student);
      ensureAttendanceHistory(student);
      ensureStudentMarks(student);
    });
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(firstDashboard));
    return firstDashboard;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.students) || typeof parsed.currentStudentId !== "string") {
      throw new Error("Dashboard data is invalid.");
    }
    if (typeof parsed.isAuthenticated !== "boolean") {
      parsed.isAuthenticated = false;
    }
    if (!parsed.isAuthenticated) {
      parsed.currentStudentId = "";
    }
    parsed.students.forEach((student) => {
      migrateStudentAttendance(student);
      ensureAttendanceHistory(student);
      ensureStudentMarks(student);
    });
    return parsed;
  } catch (error) {
    console.error("Could not load dashboard data.", error);
    const fallback = demoStudentData();
    fallback.students.forEach((student) => {
      migrateStudentAttendance(student);
      ensureAttendanceHistory(student);
      ensureStudentMarks(student);
    });
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function saveDashboardData() {
  try {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(dashboardData));
    return true;
  } catch (error) {
    console.error("Could not save dashboard data.", error);
    return false;
  }
}

const dashboardData = loadDashboardData();
if (dashboardNeedsSave) saveDashboardData();
const getCurrentStudent = () => dashboardData.students.find((student) => student.id === dashboardData.currentStudentId) || null;

const appShell = document.querySelector("#app-shell");
const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const loginUsername = document.querySelector("#login-username");
const loginPassword = document.querySelector("#login-password");
const passwordVisibilityToggle = document.querySelector("#password-visibility-toggle");
const loginError = document.querySelector("#login-error");
const profileDialog = document.querySelector("#profile-dialog");
const darkThemeToggle = document.querySelector("#dark-theme-toggle");
const profileLogoutError = document.querySelector("#profile-logout-error");
const taskList = document.querySelector("#task-list");
const taskDialog = document.querySelector("#task-dialog");
const notificationsDialog = document.querySelector("#notifications-dialog");
const notificationCount = document.querySelector("#notification-count");
const notificationList = document.querySelector("#notification-list");
const taskForm = document.querySelector("#task-form");
const toast = document.querySelector("#toast");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const searchInput = document.querySelector("#search-input");
let tasks = loadTasks();
let currentView = "all";
let toastTimeout;

function getStudentTheme(student) {
  return student && student.preferences && ["light", "dark"].includes(student.preferences.theme)
    ? student.preferences.theme
    : "light";
}

function applyStudentTheme(student) {
  const theme = getStudentTheme(student);
  const themeValue = student ? theme : "light";
  appShell.dataset.theme = themeValue;
  taskDialog.dataset.theme = themeValue;
  profileDialog.dataset.theme = themeValue;
  notificationsDialog.dataset.theme = themeValue;
  darkThemeToggle.checked = themeValue === "dark";
}

function openProfileDialog() {
  const student = getCurrentStudent();
  if (!student) return;

  document.querySelector("#profile-full-name").textContent = student.name;
  document.querySelector("#profile-username").textContent = student.username;
  document.querySelector("#profile-student-id").textContent = student.id;
  profileLogoutError.textContent = "";
  applyStudentTheme(student);
  profileDialog.showModal();
}

function logoutCurrentStudent() {
  const previousStudentId = dashboardData.currentStudentId;
  const wasAuthenticated = dashboardData.isAuthenticated;
  dashboardData.isAuthenticated = false;
  dashboardData.currentStudentId = "";

  if (!saveDashboardData()) {
    dashboardData.isAuthenticated = wasAuthenticated;
    dashboardData.currentStudentId = previousStudentId;
    profileLogoutError.textContent = "Logout could not be saved. You are still signed in; please try again.";
    return;
  }

  profileLogoutError.textContent = "";
  profileDialog.close();
  updateAuthView();
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const firstTasks = initialTasks();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(firstTasks));
      return firstTasks;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some((task) => !isValidTask(task))) {
      throw new Error("Saved task data has an invalid format.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not load saved tasks.", error);
    showToast("Could not load saved tasks. Check your browser storage settings.");
    return [];
  }
}

function isValidTask(task) {
  return task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.description === "string" &&
    typeof task.dueDate === "string" &&
    ["high", "medium", "low"].includes(task.priority) &&
    typeof task.completed === "boolean";
}

function saveTasks() {
  const student = getCurrentStudent();
  if (!student) {
    console.error("Could not save tasks because there is no active student.");
    showToast("Your changes could not be saved. Sign in and try again.");
    return false;
  }

  const previousTasks = student.tasks;
  student.tasks = tasks;
  if (saveDashboardData()) return true;
  student.tasks = previousTasks;
  showToast("Your changes could not be saved. Check your browser storage settings.");
  return false;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function formatDate(value) {
  if (!value) return "No due date";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (currentView === "today" && (task.completed || task.dueDate !== dateKey(today()))) return false;
    if (currentView === "upcoming" && (task.completed || !task.dueDate || task.dueDate <= dateKey(today()))) return false;
    if (currentView === "completed" && !task.completed) return false;
    if (statusFilter.value === "active" && task.completed) return false;
    if (statusFilter.value === "completed" && !task.completed) return false;
    if (priorityFilter.value !== "all" && task.priority !== priorityFilter.value) return false;
    return !query || `${task.title} ${task.description}`.toLocaleLowerCase().includes(query);
  }).sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority] || b.createdAt - a.createdAt;
  });
}

function makeDateIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const rect = document.createElementNS(svg.namespaceURI, "rect");
  rect.setAttribute("x", "4"); rect.setAttribute("y", "5.5");
  rect.setAttribute("width", "16"); rect.setAttribute("height", "15");
  rect.setAttribute("rx", "2");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", "M8 3.5v4M16 3.5v4M4 10h16");
  svg.append(rect, path);
  return svg;
}

function renderTask(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " completed-task" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `${task.completed ? "Mark as in progress" : "Mark as completed"}: ${task.title}`);
  checkbox.addEventListener("change", () => updateTask(task.id, { completed: checkbox.checked }));

  const main = document.createElement("div");
  main.className = "task-main";
  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  main.append(title);
  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    main.append(description);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const dueDate = document.createElement("span");
  const isOverdue = !task.completed && task.dueDate && task.dueDate < dateKey(today());
  dueDate.className = `task-date${isOverdue ? " overdue" : ""}`;
  dueDate.append(makeDateIcon(), document.createTextNode(isOverdue ? `Overdue · ${formatDate(task.dueDate)}` : formatDate(task.dueDate)));
  const priority = document.createElement("span");
  priority.className = `priority-badge ${task.priority}`;
  priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`;
  meta.append(dueDate, priority);
  main.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "icon-button";
  edit.setAttribute("aria-label", `Edit ${task.title}`);
  edit.title = "Edit task";
  edit.textContent = "✎";
  edit.addEventListener("click", () => openEditor(task));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-button delete-task";
  remove.setAttribute("aria-label", `Delete ${task.title}`);
  remove.title = "Delete task";
  remove.textContent = "×";
  remove.addEventListener("click", () => deleteTask(task));
  actions.append(edit, remove);
  card.append(checkbox, main, actions);
  return card;
}

function updateAuthView() {
  if (!appShell || !loginScreen) return;

  const student = getCurrentStudent();
  const isLoggedIn = dashboardData.isAuthenticated === true && Boolean(student);
  appShell.classList.toggle("hidden", !isLoggedIn);
  loginScreen.classList.toggle("hidden", isLoggedIn);
  applyStudentTheme(isLoggedIn ? student : null);

  if (isLoggedIn) {
    tasks = Array.isArray(student.tasks) ? student.tasks : [];
    const profileName = document.querySelector(".profile-text strong");
    const profileLabel = document.querySelector(".profile-text span");
    const studentName = document.querySelector("#student-name");
    const avatarInitial = student.name.charAt(0).toUpperCase();
    if (student && profileName) {
      profileName.textContent = student.name;
    }
    if (student && profileLabel) {
      profileLabel.textContent = "Your study space";
    }
    if (studentName) studentName.textContent = student.name;
    document.querySelector(".avatar").textContent = avatarInitial;
    document.querySelector(".top-avatar").textContent = avatarInitial;
  }
}

function handleLogin(event) {
  event.preventDefault();

  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  const student = dashboardData.students.find((entry) => entry.username === username && entry.password === password);

  if (!student) {
    loginError.textContent = "Incorrect username or password. Please try again.";
    loginError.classList.add("visible");
    return;
  }

  dashboardData.currentStudentId = student.id;
  dashboardData.isAuthenticated = true;
  saveDashboardData();
  loginError.classList.remove("visible");
  loginError.textContent = "";
  updateAuthView();
  render();
}

function renderAttendance(student) {
  const subjectList = document.querySelector("#attendance-subjects");
  const overallValue = document.querySelector("#attendance-overall-value");
  const overallCount = document.querySelector("#attendance-overall-count");
  const alert = document.querySelector("#attendance-alert");
  const subjects = student && student.attendance && Array.isArray(student.attendance.subjects)
    ? student.attendance.subjects.filter((subject) =>
      Number.isInteger(subject.attended) &&
      Number.isInteger(subject.total) &&
      subject.total > 0 &&
      subject.attended >= 0 &&
      subject.attended <= subject.total)
    : [];
  const overall = summarizeAttendance(subjects);
  const overallPercentage = overall.total ? Math.round(overall.attended / overall.total * 100) : 0;

  overallValue.textContent = `${overallPercentage}%`;
  overallCount.textContent = `${overall.attended} of ${overall.total} classes attended`;
  alert.className = `attendance-alert ${overallPercentage < 75 ? "attendance-warning" : "attendance-safe"}`;
  alert.textContent = overallPercentage < 75
    ? "Attendance is below 75%. Please attend upcoming classes to improve it."
    : "Attendance is at or above 75%. Your overall attendance is on track.";
  subjectList.replaceChildren();

  subjects.forEach((subject) => {
    const percentage = Math.round(subject.attended / subject.total * 100);
    const card = document.createElement("article");
    card.className = "attendance-subject-card";

    const header = document.createElement("div");
    header.className = "attendance-subject-header";
    const name = document.createElement("h3");
    name.textContent = subject.name;
    const status = document.createElement("span");
    status.className = `attendance-status ${percentage < 75 ? "attendance-status-low" : "attendance-status-good"}`;
    status.textContent = percentage < 75 ? "Below 75%" : "On track";
    header.append(name, status);

    const details = document.createElement("div");
    details.className = "attendance-subject-details";
    const count = document.createElement("span");
    count.textContent = `${subject.attended} of ${subject.total} classes`;
    const value = document.createElement("strong");
    value.textContent = `${percentage}%`;
    details.append(count, value);

    const progress = document.createElement("div");
    progress.className = `attendance-progress ${percentage < 75 ? "attendance-progress-low" : ""}`;
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", `${subject.name} attendance`);
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(percentage));
    const bar = document.createElement("span");
    bar.className = "attendance-progress-bar";
    bar.style.width = `${percentage}%`;
    progress.append(bar);

    card.append(header, details, progress);
    subjectList.append(card);
  });
  renderAttendanceHistory(student);
  renderAttendanceCalculator(subjects);
}

function renderAttendanceHistory(student) {
  const filter = document.querySelector("#attendance-history-filter");
  const rows = document.querySelector("#attendance-history-rows");
  const emptyMessage = document.querySelector("#attendance-history-empty");
  const history = student && student.attendance && Array.isArray(student.attendance.history)
    ? student.attendance.history
    : [];
  const previousFilter = filter.value;
  const subjects = student && student.attendance && Array.isArray(student.attendance.subjects)
    ? student.attendance.subjects
    : [];

  filter.replaceChildren(new Option("All subjects", "all"));
  subjects.forEach((subject) => filter.add(new Option(subject.name, subject.name)));
  filter.value = subjects.some((subject) => subject.name === previousFilter) ? previousFilter : "all";

  const selectedHistory = history
    .filter((record) => filter.value === "all" || record.subject === filter.value)
    .slice()
    .sort((first, second) => second.date.localeCompare(first.date));
  rows.replaceChildren();
  selectedHistory.forEach((record) => {
    const row = document.createElement("tr");
    const subjectCell = document.createElement("td");
    const dateCell = document.createElement("td");
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    subjectCell.textContent = record.subject;
    dateCell.textContent = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(`${record.date}T00:00:00`));
    status.className = `history-status ${record.status === "Present" ? "history-status-present" : "history-status-absent"}`;
    status.textContent = record.status;
    statusCell.append(status);
    row.append(subjectCell, dateCell, statusCell);
    rows.append(row);
  });
  emptyMessage.hidden = selectedHistory.length > 0;
}

function renderAttendanceCalculator(subjects) {
  const calculator = document.querySelector("#attendance-calculator-list");
  calculator.replaceChildren();

  subjects.forEach((subject) => {
    const percentage = subject.attended / subject.total * 100;
    const item = document.createElement("article");
    item.className = "attendance-calculator-card";
    const heading = document.createElement("h4");
    const result = document.createElement("p");
    heading.textContent = subject.name;
    if (percentage >= 75) {
      result.className = "calculator-on-track";
      result.textContent = `${Math.round(percentage)}% currently — on track.`;
    } else {
      const requiredClasses = Math.ceil(3 * subject.total - 4 * subject.attended);
      const classLabel = requiredClasses === 1 ? "class" : "classes";
      result.className = "calculator-below-target";
      result.textContent = `${Math.round(percentage)}% currently — attend the next ${requiredClasses} consecutive ${classLabel} to reach at least 75%.`;
    }
    item.append(heading, result);
    calculator.append(item);
  });
}

function gradeForPercentage(percentage) {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}

function formatPercentage(value) {
  return `${Number(value.toFixed(1))}%`;
}

function renderMarks(student) {
  const rows = document.querySelector("#marks-rows");
  const overallPercentage = document.querySelector("#overall-marks-percentage");
  const overallGrade = document.querySelector("#overall-marks-grade");
  const marks = student && Array.isArray(student.marks) ? student.marks : [];
  let totalMarks = 0;
  let totalMaximum = 0;
  rows.replaceChildren();

  marks.forEach((record) => {
    if (!record || typeof record.subject !== "string" ||
      !Number.isFinite(record.marks) ||
      !Number.isFinite(record.maximum) ||
      record.maximum <= 0 ||
      record.marks < 0 ||
      record.marks > record.maximum) return;

    totalMarks += record.marks;
    totalMaximum += record.maximum;
    const percentage = record.marks / record.maximum * 100;
    const row = document.createElement("tr");
    const subject = document.createElement("th");
    subject.scope = "row";
    subject.textContent = record.subject;
    const marksCell = document.createElement("td");
    marksCell.textContent = `${record.marks} / ${record.maximum}`;
    const percentageCell = document.createElement("td");
    percentageCell.textContent = formatPercentage(percentage);
    const gradeCell = document.createElement("td");
    const grade = document.createElement("span");
    grade.className = `marks-grade marks-grade-${gradeForPercentage(percentage).toLowerCase()}`;
    grade.textContent = gradeForPercentage(percentage);
    gradeCell.append(grade);
    row.append(subject, marksCell, percentageCell, gradeCell);
    rows.append(row);
  });

  if (totalMaximum > 0) {
    const percentage = totalMarks / totalMaximum * 100;
    overallPercentage.textContent = formatPercentage(percentage);
    overallGrade.textContent = `Grade ${gradeForPercentage(percentage)}`;
  } else {
    overallPercentage.textContent = "—";
    overallGrade.textContent = "No marks available";
  }
}

function getNotifications(student, studentTasks) {
  if (!student) return [];
  const notifications = [];
  const subjects = student.attendance && Array.isArray(student.attendance.subjects)
    ? student.attendance.subjects
    : [];

  subjects.forEach((subject) => {
    if (!subject || typeof subject.name !== "string" ||
      !Number.isFinite(subject.attended) ||
      !Number.isFinite(subject.total) ||
      subject.total <= 0 ||
      subject.attended < 0 ||
      subject.attended > subject.total) return;
    const percentage = subject.attended / subject.total * 100;
    if (percentage < 75) {
      notifications.push({
        type: "attendance",
        title: "Low attendance",
        message: `${subject.name}: ${Math.round(percentage)}% (${subject.attended} of ${subject.total} classes).`
      });
    }
  });

  const todayKey = dateKey(today());
  studentTasks.filter((task) => !task.completed).forEach((task) => {
    notifications.push({
      type: "task",
      title: "Task pending",
      message: task.title
    });

    if (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) && task.dueDate >= todayKey) {
      notifications.push({
        type: "deadline",
        title: "Upcoming deadline",
        message: `${task.title} — ${formatDate(task.dueDate)}`
      });
    }
  });
  return notifications;
}

function renderNotifications(student) {
  const notifications = getNotifications(student, tasks);
  notificationCount.textContent = String(notifications.length);
  document.querySelector("#open-notifications-button").setAttribute(
    "aria-label",
    `Notifications (${notifications.length})`
  );
  notificationList.replaceChildren();

  if (!notifications.length) {
    const empty = document.createElement("li");
    empty.className = "notification-empty";
    empty.textContent = "You’re all caught up. There are no notifications right now.";
    notificationList.append(empty);
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("li");
    item.className = "notification-item";
    const marker = document.createElement("span");
    marker.className = `notification-marker notification-marker-${notification.type}`;
    marker.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "notification-copy";
    const title = document.createElement("strong");
    title.textContent = notification.title;
    const message = document.createElement("p");
    message.textContent = notification.message;
    copy.append(title, message);
    item.append(marker, copy);
    notificationList.append(item);
  });
}

function render() {
  const allCount = tasks.length;
  const todayKey = dateKey(today());
  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed);
  const upcomingCount = pendingTasks.filter((task) => task.dueDate && task.dueDate >= todayKey).length;
  const student = getCurrentStudent();
  renderNotifications(student);
  renderMarks(student);
  const attendanceSubjects = student && student.attendance && Array.isArray(student.attendance.subjects)
    ? student.attendance.subjects.filter((subject) =>
      Number.isInteger(subject.attended) &&
      Number.isInteger(subject.total) &&
      subject.total > 0 &&
      subject.attended >= 0 &&
      subject.attended <= subject.total)
    : [];
  const attendance = summarizeAttendance(attendanceSubjects);
  const hasAttendance = attendance.total > 0;
  document.querySelector("#all-count").textContent = allCount;
  document.querySelector("#today-count").textContent = pendingTasks.filter((task) => task.dueDate === todayKey).length;
  document.querySelector("#completed-count").textContent = completedCount;
  document.querySelector("#attendance-stat").textContent = hasAttendance
    ? `${Math.round(attendance.attended / attendance.total * 100)}%`
    : "Coming in Stage 4";
  document.querySelector("#attendance-note").textContent = hasAttendance
    ? `${attendance.attended} of ${attendance.total} classes attended`
    : "Attendance summary is being prepared.";
  document.querySelector("#attendance-stat").classList.toggle("stat-value-coming", !hasAttendance);
  renderAttendance(student);
  document.querySelector("#pending-task-stat").textContent = pendingTasks.length;
  document.querySelector("#completed-task-stat").textContent = completedCount;
  document.querySelector("#upcoming-deadline-stat").textContent = upcomingCount;
  document.querySelector("#list-count").textContent = getVisibleTasks().length;

  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren();
  if (visibleTasks.length) {
    visibleTasks.forEach((task) => taskList.append(renderTask(task)));
    return;
  }

  const empty = document.createElement("div");
  empty.className = "empty-state";
  const icon = document.createElement("div");
  icon.className = "empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = currentView === "completed" ? "✓" : "✦";
  const heading = document.createElement("h3");
  const message = document.createElement("p");
  if (searchInput.value.trim()) {
    heading.textContent = "No tasks found";
    message.textContent = "Try a different search or adjust your filters.";
  } else if (currentView === "completed") {
    heading.textContent = "Your wins will show up here";
    message.textContent = "Complete a task and take a moment to celebrate it.";
  } else {
    heading.textContent = currentView === "today" ? "Nothing due today" : currentView === "upcoming" ? "No upcoming tasks" : "A fresh start";
    message.textContent = currentView === "today" ? "Enjoy the breathing room, or add something you want to work on." : "Add a task to make a little progress toward your goals.";
  }
  const addButton = document.createElement("button");
  addButton.className = "button button-primary";
  addButton.type = "button";
  addButton.textContent = "Add a task";
  addButton.addEventListener("click", () => openEditor());
  empty.append(icon, heading, message);
  if (currentView !== "completed" || tasks.length === 0) empty.append(addButton);
  taskList.append(empty);
}

function setView(view, priority) {
  currentView = view;
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.remove("active"));
  const activeButton = priority
    ? document.querySelector(`[data-priority="${priority}"]`)
    : document.querySelector(`[data-view="${view}"]`);
  if (activeButton) activeButton.classList.add("active");

  const names = { all: "All tasks", today: "Today", upcoming: "Upcoming", completed: "Completed" };
  const title = priority ? `${priority[0].toUpperCase()}${priority.slice(1)} priority` : names[view];
  document.querySelector("#breadcrumb-current").textContent = title;
  document.querySelector("#page-title").innerHTML = `${title}<span class="title-period">.</span>`;
  document.querySelector("#list-title").childNodes[0].textContent = view === "all" && !priority ? "Your tasks " : `${title} `;
  document.querySelector("#list-description").textContent = view === "all" && !priority
    ? "Everything you’re working on, all in one place."
    : view === "today" ? "The things to focus on today."
      : view === "upcoming" ? "A look at what’s coming up next."
        : view === "completed" ? "Look at everything you’ve accomplished."
          : `Your ${priority} priority tasks.`;
  statusFilter.value = view === "completed" ? "completed" : view === "today" || view === "upcoming" ? "active" : "all";
  priorityFilter.value = priority || "all";
  render();
}

function openEditor(task) {
  taskForm.reset();
  document.querySelector("#task-id").value = task ? task.id : "";
  document.querySelector("#task-title").value = task ? task.title : "";
  document.querySelector("#task-description").value = task ? task.description : "";
  document.querySelector("#task-due-date").value = task ? task.dueDate : "";
  document.querySelector("#task-priority").value = task ? task.priority : "medium";
  document.querySelector("#dialog-title").innerHTML = task ? "Edit task<span class=\"title-period\">.</span>" : "Add a task<span class=\"title-period\">.</span>";
  document.querySelector("#save-task-button").innerHTML = task ? "Save changes <span aria-hidden=\"true\">→</span>" : "Add task <span aria-hidden=\"true\">→</span>";
  taskDialog.showModal();
  document.querySelector("#task-title").focus();
}

function updateTask(id, changes) {
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const previous = tasks[index];
  const previousTasks = tasks;
  tasks = tasks.map((task) => task.id === id ? { ...task, ...changes } : task);
  if (saveTasks()) {
    showToast(changes.completed === undefined ? "Task updated." : changes.completed ? "Task completed. Nice work!" : "Task moved back to in progress.");
  } else {
    tasks = previousTasks;
  }
  render();
}

function deleteTask(task) {
  if (!window.confirm(`Delete “${task.title}”? This can’t be undone.`)) return;
  const previous = tasks;
  tasks = tasks.filter((item) => item.id !== task.id);
  if (saveTasks()) showToast("Task deleted.");
  else tasks = previous;
  render();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
document.querySelectorAll("[data-priority]").forEach((button) => {
  button.addEventListener("click", () => setView("all", button.dataset.priority));
});
document.querySelector("#add-task-button").addEventListener("click", () => openEditor());
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => taskDialog.close()));
taskDialog.addEventListener("click", (event) => {
  if (event.target === taskDialog) taskDialog.close();
});
taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!taskForm.reportValidity()) return;
  const id = document.querySelector("#task-id").value;
  const existingIndex = tasks.findIndex((task) => task.id === id);
  const previous = existingIndex >= 0 ? tasks[existingIndex] : null;
  const previousTasks = tasks;
  const task = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: document.querySelector("#task-title").value.trim(),
    description: document.querySelector("#task-description").value.trim(),
    dueDate: document.querySelector("#task-due-date").value,
    priority: document.querySelector("#task-priority").value,
    completed: previous ? previous.completed : false,
    createdAt: previous ? previous.createdAt : Date.now()
  };
  if (existingIndex >= 0) tasks = tasks.map((item) => item.id === id ? task : item);
  else tasks = [task, ...tasks];
  if (saveTasks()) {
    taskDialog.close();
    showToast(previous ? "Your changes have been saved." : "Task added. You’ve got this!");
  } else tasks = previousTasks;
  render();
});
statusFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);
document.querySelector("#attendance-history-filter").addEventListener("change", () => {
  renderAttendanceHistory(getCurrentStudent());
});
document.querySelector("#open-notifications-button").addEventListener("click", () => {
  renderNotifications(getCurrentStudent());
  notificationsDialog.showModal();
  document.querySelector("#open-notifications-button").setAttribute("aria-expanded", "true");
});
document.querySelector("#close-notifications-dialog").addEventListener("click", () => notificationsDialog.close());
notificationsDialog.addEventListener("close", () => {
  document.querySelector("#open-notifications-button").setAttribute("aria-expanded", "false");
});
notificationsDialog.addEventListener("click", (event) => {
  if (event.target === notificationsDialog) notificationsDialog.close();
});
document.querySelector("#open-profile-button").addEventListener("click", openProfileDialog);
document.querySelector("#close-profile-dialog").addEventListener("click", () => profileDialog.close());
document.querySelector("#logout-button").addEventListener("click", logoutCurrentStudent);
profileDialog.addEventListener("click", (event) => {
  if (event.target === profileDialog) profileDialog.close();
});
darkThemeToggle.addEventListener("change", () => {
  const student = getCurrentStudent();
  if (!student) return;

  const previousPreferences = student.preferences;
  const nextTheme = darkThemeToggle.checked ? "dark" : "light";
  student.preferences = {
    ...(previousPreferences && typeof previousPreferences === "object" && !Array.isArray(previousPreferences)
      ? previousPreferences
      : {}),
    theme: nextTheme
  };
  applyStudentTheme(student);
  if (!saveDashboardData()) {
    student.preferences = previousPreferences;
    applyStudentTheme(student);
    showToast("Your theme preference could not be saved. Check your browser storage settings.");
  }
});
loginForm.addEventListener("submit", handleLogin);
passwordVisibilityToggle.addEventListener("click", () => {
  const showPassword = loginPassword.type === "password";
  loginPassword.type = showPassword ? "text" : "password";
  passwordVisibilityToggle.setAttribute("aria-pressed", String(showPassword));
  passwordVisibilityToggle.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
});
updateAuthView();

const currentDate = new Date();
document.querySelector("#header-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(currentDate);
document.querySelector("#welcome-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(currentDate).toUpperCase();
render();
