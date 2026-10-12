"use strict";

const STORAGE_KEY = "studyspace.tasks.v1";
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

const taskList = document.querySelector("#task-list");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const toast = document.querySelector("#toast");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const searchInput = document.querySelector("#search-input");
let tasks = loadTasks();
let currentView = "all";
let toastTimeout;

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("Could not save tasks.", error);
    showToast("Your changes could not be saved. Check your browser storage settings.");
    return false;
  }
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

function render() {
  const allCount = tasks.length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const activeTasks = tasks.filter((task) => !task.completed);
  const todayCount = activeTasks.filter((task) => task.dueDate === dateKey(today())).length;
  document.querySelector("#all-count").textContent = allCount;
  document.querySelector("#today-count").textContent = todayCount;
  document.querySelector("#completed-count").textContent = completedCount;
  document.querySelector("#total-stat").textContent = allCount;
  document.querySelector("#progress-stat").textContent = activeTasks.length;
  document.querySelector("#done-stat").textContent = completedCount;
  document.querySelector("#due-stat").textContent = todayCount;
  document.querySelector("#completion-rate").textContent = `${allCount ? Math.round(completedCount / allCount * 100) : 0}%`;
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
  tasks[index] = { ...previous, ...changes };
  if (saveTasks()) {
    showToast(changes.completed === undefined ? "Task updated." : changes.completed ? "Task completed. Nice work!" : "Task moved back to in progress.");
  } else {
    tasks[index] = previous;
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
  const task = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: document.querySelector("#task-title").value.trim(),
    description: document.querySelector("#task-description").value.trim(),
    dueDate: document.querySelector("#task-due-date").value,
    priority: document.querySelector("#task-priority").value,
    completed: previous ? previous.completed : false,
    createdAt: previous ? previous.createdAt : Date.now()
  };
  if (existingIndex >= 0) tasks[existingIndex] = task;
  else tasks.unshift(task);
  if (saveTasks()) {
    taskDialog.close();
    showToast(previous ? "Your changes have been saved." : "Task added. You’ve got this!");
  } else if (previous) {
    tasks[existingIndex] = previous;
  } else {
    tasks = tasks.filter((item) => item.id !== task.id);
  }
  render();
});
statusFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);

const currentDate = new Date();
document.querySelector("#header-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(currentDate);
document.querySelector("#welcome-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(currentDate).toUpperCase();
render();
