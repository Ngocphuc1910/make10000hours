//EXERCISE 1: Create a function that takes an array of tasks and returns their formatted status. This is similar to what we do in our project's task list.


interface Task {
    title: string;
    status: 'todo' | 'in_progress' | 'completed';
    timeSpent: number; // in minutes
};


  //Task: Create a function that:
    //Takes an array of tasks
    //Formats each task's status with time spent
    //Returns an array of formatted messages

const reformatTask = (formatTask: Task[]) => {
   // - 'const reformatTask': Creates a constant function named 'reformatTask'
    // - '(formatTask: Task[])': Parameter that accepts an array of Task objects
    // - '=>': Arrow function syntax
    return formatTask.map (task => {
      // - 'formatTask.map': Takes each item from the array one by one
      // - 'task =>': Each individual task from the array gets this name
      // Think of it like a loop: for each task in formatTask...
      
      const taskCopy = {...task};
       // - Creates a new object 'taskCopy'
      // - '...task': Spread operator copies all properties from 'task'
      // - This creates a safe copy so we don't modify the original task
      //reating taskCopy is a good practice when: You plan to modify the object You want to prevent accidental modifications You're working with shared data The object might be used elsewhere in your code Example where copy IS needed:
      //So in our current example, while taskCopy isn't strictly necessary, it's not wrong to have it - it's just being extra safe! 😊

      switch(taskCopy.status) {
        case 'completed':
          return `Task ${taskCopy.title} has spent ${taskCopy.timeSpent}`;
        case 'in_progress':
          return `Task ${taskCopy.title} has spent ${taskCopy.timeSpent}`;
        case 'todo':
          return `Task ${taskCopy.title} has spent ${taskCopy.timeSpent}`;
        default:
          return 'No task available'
      }
    } )
    
};

const tasks = [
  {
    title: "Study React",
    status: "completed",
    timeSpent: 120
  },
  {
    title: "Practice TypeScript",
    status: "in_progress",
    timeSpent: 45
  },
  {
    title: "Learn Stuff",
    status: "todo",
    timeSpent: 0
  }
];

//trong cái đọạn function này, mình mới define thôi, nên đằng sau cái formatTask.map thì dùng task chứ không phải tasks như mình nhầm lẫn là lâys được từ cái biến ở trên.

//Xuống đưới này lúc console log thì mới dùng biến thực sự vào nên mới dùng tasks.
console.log(reformatTask(tasks));