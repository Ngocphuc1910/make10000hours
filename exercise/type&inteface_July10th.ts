//Basic Interface vs Type Exercise July 10th

// SAMPLE: Create an interface and type for a basic timer
// Interface version
interface SampleTimer {
    minutes: number;
    seconds: number;
    isRunning: boolean;
}

// Type version
type SampleTimerType = {
    minutes: number;
    seconds: number;
    isRunning: boolean;
}

// Sample usage:
const pomodoroTimer: SampleTimer = {
    minutes: 25,
    seconds: 0,
    isRunning: true
}


// YOUR TASK: Create both an interface and type for a focus session tracker
// It should include: duration (in minutes), category (work/break), and status (active/paused)
// Then create an object using your interface or type

// Write your solution here:
interface FocusTracker {
    duration: number;
    category: "work" | "break";
    status: "active" | "paused";
    startTime?: Date;
}

type FocusTrackerType = {
    duration: number;
    category: "work" | "break";
    status: "active" | "paused";
}

const focusTrackerDefault: FocusTrackerType = {
    duration: 25,
    category: "work",
    status: "active"
}

const focusTracker: FocusTracker = {
    duration: 25,
    category: "work",
    status: "active"
}











//Union Types Exercise
// SAMPLE: Create a union type for notification priority
type SamplePriority = 'low' | 'medium' | 'high';

function handleSampleNotification(priority: SamplePriority) {
    switch(priority) {
        case 'low':
            return 'Show in notification center';
        case 'medium':
            return 'Show toast notification';
        case 'high':
            return 'Show modal alert';
    }
}

// YOUR TASK: Create a union type for focus session types
// Should include: 'pomodoro', 'deepFocus', 'quickBreak', 'longBreak'
// Then create a function that returns the duration for each type

type FocusType = 'pomodoro' | 'deepFocus' | 'quickBreak' | 'longBreak';

function getSessionDuration(type: FocusType): number {
    switch(type) {
        case 'pomodoro':
            return 25;
        case 'deepFocus':
            return 45;
        case 'quickBreak':
            return 5;
        case 'longBreak':
            return 15;
    }
}









//3. GENERIC TYPE: SAMPLE: Create a generic result container
type SampleResult<T> = {
    data: T;
    timestamp: Date;
    success: boolean;
}

// Sample usage:
type NumberResult = SampleResult<number>;
const sampleData: NumberResult = {
    data: 42,
    timestamp: new Date(),
    success: true
}


// YOUR TASK: Create a generic analytics container
// Should include: value of generic type, startDate, endDate, and trend ('up' | 'down' | 'same')

// Then use it with both number and string types
// Create two variables using your type:
// 1. For focus time (number)
// 2. For focus status (string)
type AnalyticsContainer<T> = {
    value: T;
    startDate: Date;
    endDate: Date;
    trend: 'up' | 'down' | 'same';
}

const focusTime: AnalyticsContainer<number> = {
    value: 25,
    startDate: new Date(),
    endDate: new Date(),
    trend: 'up'
}

let focusStatus: AnalyticsContainer<string> = {
    value: 'focused',
    startDate: new Date(),
    endDate: new Date(),
    trend: 'same'
}

// => ồ, THÌ RA LÀ T LÀ LÚC DEFINE THẾ THÔI, CÒN LÚC XÀI THÌ MUỐN XÀI CÁI GÌ THÌ XÀI, ĐIỀN VÀO TƯƠNG ƯNG.
//=> lúc define type thì dùng dấu {} chứ không phải ()





//4. Utility Types Exercise
// SAMPLE: Using Pick and Partial
interface SampleTask {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    dueDate: Date;
}

// Create a type for updating task
type SampleTaskUpdate = Partial<Pick<SampleTask, 'title' | 'description' | 'completed'>>;

// Sample usage:
const updateTask: SampleTaskUpdate = {
    title: "New title",  // Optional
    completed: true      // Optional
}


// YOUR TASK: Create a FocusSession interface and then use utility types
// First create this interface:
interface FocusSession {
    id: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    type: 'pomodoro' | 'deepFocus';
    notes: string;
}


type newFocusSession = Pick <FocusSession, 'startTime' | 'type'>;
type updateFocusSession = Partial<Pick<FocusSession, 'startTime' | 'endTime' | 'duration' | 'notes'>>;

// Then create:
// 1. A type for creating a new session (Required fields: startTime, type)
// 2. A type for updating a session (All fields optional except id)
// Hint: Use Pick, Partial, and Required utility types









//5. Discriminated Unions Exercise
// SAMPLE: Create a discriminated union for different notification types
type SampleBaseNotification = {
    id: string;
    timestamp: Date;
}

type SampleEmailNotification = SampleBaseNotification & {
    type: 'email';
    emailAddress: string;
    subject: string;
}

type SamplePushNotification = SampleBaseNotification & {
    type: 'push';
    deviceId: string;
    message: string;
}

type SampleNotification = SampleEmailNotification | SamplePushNotification;

// Sample usage:
function handleSampleNotification(notification: SampleNotification) {
    switch(notification.type) {
        case 'email':
            return `Send email to ${notification.emailAddress}`;
        case 'push':
            return `Send push to ${notification.deviceId}`;
    }
}


// YOUR TASK: Create a discriminated union for different focus interruption types
// Base type should have: id and timestamp
// Create two types of interruptions:
// 1. SystemInterruption (type: 'system', processName: string, priority: number)
// 2. UserInterruption (type: 'user', reason: string, duration: number)
// Then create a function that handles both types of interruptions

// Write your solution here:
type BaseInterruption = {
    id: number,
    timestamp: string,
}

type SystemInterruption = BaseInterruption & {
    type: 'system',
    processName: string,
    priority: number,
}

type UserInterruption = BaseInterruption & {
    type: 'user',
    reason: string,
    duration: number,
}

type FocusInterruption = SystemInterruption | UserInterruption;

function handleInterruption(interruption: FocusInterruption): string {
    switch(intetrruption.type) {
        case 'system':
            return `System interruption: ${interruption.processName} with priority ${interruption.priority}`;
        case 'user':
            return `User interruption: ${interruption.reason} for ${interruption.duration} minutes`;
    }
}