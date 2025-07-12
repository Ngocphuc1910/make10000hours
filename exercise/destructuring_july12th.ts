//1.OBJECT DESTRUCTURING

// Real example from our DeepFocusStore
const timeData = {
  onScreenTime: 120,
  workingTime: 90,
  deepFocusTime: 60,
  overrideTime: 15
};

// Without destructuring
const onScreenTime = timeData.onScreenTime;
const workingTime = timeData.workingTime;

// With destructuring
const { onScreenTime, workingTime } = timeData;
// Now you can use onScreenTime and workingTime directly


// You have a task object from our project
const taskData = {
  title: "Implement login page",
  status: "in_progress",
  priority: "high",
  dueDate: "2025-07-15",
  assignedTo: "John",
  timeSpent: 120,
  description: "Create responsive login page with OAuth"
};

// Task: Use object destructuring to:
// 1. Extract title and status
// 2. Extract priority and dueDate, but rename them to taskPriority and deadline
// 3. Extract timeSpent with a default value of 0 if it doesn't exist

//Solve: exercise 1

const { title, status } = taskData;
const {priority: taskPriority, dueDate: deadline} = taskData;
const {timeSpent = 0} = taskData;

// => Syntax error: Use comma , instead of semicolon ; when renaming properties
// => Typo: timespent should be timeSpent (JavaScript is case-sensitive)









//2. ARRAY DESTRUCTURING

// You have an API response with user activity stats
const activityStats = ["John Doe", 480, 12, 5, "high"];
// Format: [userName, totalMinutes, completedTasks, activeProjects, productivityLevel]

// Task: Use array destructuring to extract:
// 1. userName and totalMinutes only
// 2. Skip userName but get totalMinutes and completedTasks
// 3. Get only the productivityLevel (last item)


const [userName, totalMinutes] = activityStats;

//=> nó lấy tương ứng 2 cái đầu tiên thôi, mấy cái sau không có thì auto bỏ qua nên mình không cần add nhiều dấu phẩy phía sau

const [, minutes, completedTasks] = activityStats;

// => nếu phía trước có bao nhiêu cái bỏ qua thì phẩy bấy nhiêu cái tương ứng
const [, , , , productivityLevel] = activityStats;

//=> Mình nhận ra là với dạng này thì chỉ ghi cái value mình muốn lấy thôi chứ không ghi biến big trước cái array đo cả.










//3. NESTED DESTRUCTURING

// You have a deep focus session data object
const sessionData = {
  user: {
    profile: {
      name: "John Doe",
      level: 3,
      preferences: {
        notifications: true,
        theme: "dark"
      }
    },
    stats: {
      totalHours: 150,
      streak: 7
    }
  },
  session: {
    duration: 120,
    focusScore: 85
  }
};

// Task: Use nested destructuring to:
// 1. Get user's name and level
// 2. Get theme preference and totalHours
// 3. Get session duration and focusScore

const {user: {profile: {name, level}}} = sessionData;

const {user: {
  profile: {preferences: {theme}}, 
  stats: {totalHours}
  }
} = sessionData;


const {session: {duration, focusScore}} = sessionData;

//=> Chỗ này rà soát lại thì mình sai nè, không phải mang cái sessionData làm cái biến đầu tiên mà nó chỉ là = sessionData ở sau thôi.
// => ở mỗi layer của nested phải có dấu semicolon (:) nữa mà mình thiếu
// => lỗi thứ 3 là không nhìn cẩn thận các layer, sesion với user bằng level nhau chứ không phải sesion under user,
// cẩn thận để nó không bị dư cái {} as well
// end of any statement đều phải có dấu (;) hết




//4. DESTRUCTURING WITH DEFAULT VALUES

// You have a user settings object that might be incomplete
const userSettings = {
  userId: "user123",
  displayName: "John",
  // Some settings might be missing
};

// Task: Extract these values with appropriate defaults:
// 1. theme (default: "light")
// 2. notificationsEnabled (default: true)
// 3. language (default: "en")
// 4. workHoursTarget (default: 40)

const { theme = "light", notificationsEnabled = true, language = "en", workHoursTarget = 40} = userSettings;
//=> const should be lower case

console.log(`
  Theme: ${theme}
  Notification: ${notificationsEnabled}
  Language: ${language}
  Total Work Hours: ${workHoursTarget}
  `);


//=> Dùng console.log thì phải đi với nhấu nháy `` chứ không phải dấu chấm đơn ''









//5. DESTRUCTURING FUNCTION PARAMETER
// Real example from our project's composeDeepFocusData function
// Without destructuring
function processTimeMetrics(input) {
  const workSessions = input.workSessions;
  const dailySiteUsages = input.dailySiteUsages;
  // ... process data
}

// With destructuring
function processTimeMetrics({ workSessions, dailySiteUsages }) {
  // Now workSessions and dailySiteUsages are directly available
  // ... process data
}


// Task: Create a function that processes a deep focus session
// The function should accept an object with session details and user preferences

// Without destructuring
function processSession(sessionConfig) {
  const duration = sessionConfig.duration || 25;
  const breakTime = sessionConfig.breakTime || 5;
  const notifications = sessionConfig.notifications || true;
  // ... process session
}

// Task: Rewrite the function using parameter destructuring with:
// 1. Default values for all parameters
// 2. Nested destructuring for user preferences
// 3. Renamed parameters


function processSession({
  duration = 25,
  breakTime = 5,
  user: {
    preferences: {
      notifications = true,
      sound: soundEnabled = true
    } = {}
  } = {}
}) {
  console.log(`
    Session duration: ${duration} minutes
    Break time: ${breakTime} minutes
    Notifications: ${notifications}
    Sound: ${soundEnabled}
  `);
}

//=>Typo in function name: procssSession should be processSession
//=>Variable name mismatch: notification vs notifications in the console.log