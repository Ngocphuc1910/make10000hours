const timer = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  sessions: 0,
  currentTaskIndex: 0, // Keep track of the current task
};

let interval;

const buttonSound = new Audio('button-sound.mp3');
const mainButton = document.getElementById('js-btn');
const nextButton = document.getElementById('js-next-btn');
const fileInput = document.getElementById('background-upload');
const settingsIcon = document.getElementById('settings-icon');
const configMenu = document.getElementById('config-menu');
const saveConfigButton = document.getElementById('save-config');
const cancelConfigButton = document.getElementById('cancel-config');
const pomodoroInput = document.getElementById('pomodoro-time');
const shortBreakInput = document.getElementById('shortbreak-time');
const longBreakInput = document.getElementById('longbreak-time');

// Handle file upload for background image
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.body.style.backgroundImage = `url(${e.target.result})`;
    };
    reader.readAsDataURL(file);
  }
});

// Toggle the configuration menu visibility when the settings icon is clicked
settingsIcon.addEventListener('click', () => {
  configMenu.classList.toggle('hidden');
});

// Handle the "Save" button click in the configuration menu
saveConfigButton.addEventListener('click', () => {
  const pomodoroTime = parseInt(pomodoroInput.value);
  const shortBreakTime = parseInt(shortBreakInput.value);
  const longBreakTime = parseInt(longBreakInput.value);

  if (
    isNaN(pomodoroTime) || pomodoroTime <= 0 ||
    isNaN(shortBreakTime) || shortBreakTime <= 0 ||
    isNaN(longBreakTime) || longBreakTime <= 0
  ) {
    alert('Please enter valid times greater than zero for all fields.');
    return;
  }

  timer.pomodoro = pomodoroTime;
  timer.shortBreak = shortBreakTime;
  timer.longBreak = longBreakTime;
  configMenu.classList.add('hidden');

  if (timer.mode === 'pomodoro') {
    switchMode('pomodoro');
  } else if (timer.mode === 'shortBreak') {
    switchMode('shortBreak');
  } else if (timer.mode === 'longBreak') {
    switchMode('longBreak');
  }

  alert('Timer settings updated successfully.');
});

// Handle the "Cancel" button click in the configuration menu
cancelConfigButton.addEventListener('click', () => {
  configMenu.classList.add('hidden');
});

mainButton.addEventListener('click', () => {
  buttonSound.play();
  const { action } = mainButton.dataset;
  if (action === 'start') {
    startTimer();
  } else {
    stopTimer();
  }
});

nextButton.addEventListener('click', () => {
  buttonSound.play();
  moveToNextMode();
});

const modeButtons = document.querySelector('#js-mode-buttons');
modeButtons.addEventListener('click', handleMode);

const taskContainer = document.getElementById('js-task-container');
const addTaskButton = document.getElementById('js-add-task');

let taskCount = 1; // Start with 1 default task

// Function to add a new task box
function addNewTask() {
  taskCount++;
  const newTask = document.createElement('div');
  newTask.classList.add('task');
  newTask.setAttribute('data-task', taskCount);

  const newTaskInput = document.createElement('input');
  newTaskInput.type = 'text';
  newTaskInput.placeholder = `Task ${taskCount}`;
  newTaskInput.id = `task-${taskCount}`;

  newTask.appendChild(newTaskInput);
  taskContainer.insertBefore(newTask, addTaskButton);

  // Update event listeners for all tasks after adding a new task
  updateTaskEventListeners();

  // Automatically select the new task and focus the input field
  selectTask(taskCount - 1);
  newTaskInput.focus();
}

// Function to set up event listeners for each task
function updateTaskEventListeners() {
  const taskElements = document.querySelectorAll('.task input');
  taskElements.forEach((input, index) => {
    input.addEventListener('focus', () => selectTask(index));
  });
}

// Event listener for adding a new task
addTaskButton.addEventListener('click', addNewTask);

// Function to select a task
function selectTask(index) {
  timer.currentTaskIndex = index;
  const taskNameDisplay = document.getElementById('current-task-name');
  const taskElements = document.querySelectorAll('.task');

  taskElements.forEach((task, i) => {
    if (i === index) {
      task.classList.add('active');
      task.classList.remove('inactive');
      taskNameDisplay.textContent = task.querySelector('input').value || `Task ${index + 1}`;
    } else {
      task.classList.remove('active');
      task.classList.add('inactive');
    }
  });
}

function getRemainingTime(endTime) {
  const currentTime = Date.parse(new Date());
  const difference = endTime - currentTime;
  const total = Number.parseInt(difference / 1000, 10);
  const minutes = Number.parseInt((total / 60) % 60, 10);
  const seconds = Number.parseInt(total % 60, 10);
  return { total, minutes, seconds };
}

function startTimer() {
  let { total } = timer.remainingTime;
  const endTime = Date.parse(new Date()) + total * 1000;
  if (timer.mode === 'pomodoro') timer.sessions++;
  mainButton.dataset.action = 'stop';
  mainButton.textContent = 'Stop';
  mainButton.classList.add('active');
  interval = setInterval(() => {
    timer.remainingTime = getRemainingTime(endTime);
    updateClock();
    total = timer.remainingTime.total;
    if (total <= 0) {
      clearInterval(interval);
      moveToNextMode();
      startTimer();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(interval);
  mainButton.dataset.action = 'start';
  mainButton.textContent = 'Start';
  mainButton.classList.remove('active');
}

function updateClock() {
  const { remainingTime } = timer;
  const minutes = `${remainingTime.minutes}`.padStart(2, '0');
  const seconds = `${remainingTime.seconds}`.padStart(2, '0');
  document.getElementById('js-minutes').textContent = minutes;
  document.getElementById('js-seconds').textContent = seconds;
  document.title = `${minutes}:${seconds} — ${timer.mode === 'pomodoro' ? 'Get back to work!' : 'Take a break!'}`;
  document.getElementById('js-progress').value = timer[timer.mode] * 60 - timer.remainingTime.total;
}

function switchMode(mode) {
  if (!timer.hasOwnProperty(mode)) {
    console.error(`Mode "${mode}" is not defined in the timer object.`);
    return;
  }
  timer.mode = mode;
  timer.remainingTime = { total: timer[mode] * 60, minutes: timer[mode], seconds: 0 };
  document.querySelectorAll('button[data-mode]').forEach(button => button.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  document.body.style.backgroundColor = `var(--${mode})`;
  document.getElementById('js-progress').setAttribute('max', timer.remainingTime.total);
  updateClock();
}

function moveToNextMode() {
  if (timer.mode === 'pomodoro') {
    if (timer.sessions % timer.longBreakInterval === 0) {
      switchMode('longBreak');
    } else {
      switchMode('shortBreak');
    }
  } else {
    switchMode('pomodoro');
    moveToNextTask(); // Move to the next task when starting a new Pomodoro session
  }
  stopTimer();
  if (Notification.permission === 'granted') {
    const text = timer.mode === 'pomodoro' ? 'Get back to work!' : 'Take a break!';
    new Notification(text);
  }
  document.querySelector(`[data-sound="${timer.mode}"]`).play();
}

function moveToNextTask() {
  timer.currentTaskIndex++;
  const taskElements = document.querySelectorAll('.task input');
  if (timer.currentTaskIndex >= taskElements.length) {
    timer.currentTaskIndex = 0; // Loop back to the first task if all tasks are completed
  }
  selectTask(timer.currentTaskIndex); // Select the new task
}

function handleMode(event) {
  const { mode } = event.target.dataset;
  if (!mode) return;
  switchMode(mode);
  stopTimer();
}

// Initialize Drag and Drop
taskContainer.addEventListener("dragstart", (event) => {
  event.target.classList.add("dragging");
  event.dataTransfer.setData("text/plain", event.target.id);
});

taskContainer.addEventListener("dragover", (event) => {
  event.preventDefault();
  const draggingTask = document.querySelector(".dragging");
  const afterTask = getDragAfterElement(taskContainer, event.clientY);
  
  if (afterTask == null) {
    taskContainer.appendChild(draggingTask);
  } else {
    taskContainer.insertBefore(draggingTask, afterTask);
  }
});

taskContainer.addEventListener("dragend", (event) => {
  event.target.classList.remove("dragging");
});

// Helper function to determine drag position
function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".task:not(.dragging)"),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

document.addEventListener('DOMContentLoaded', () => {
  if ('Notification' in window) {
    if (
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(
            'Awesome! You will be notified at the start of each session'
          );
        }
      });
    }
  }
  switchMode('pomodoro');
  selectTask(0); // Highlight the first task by default
  updateTaskEventListeners(); // Ensure all tasks have correct event listeners at startup
});