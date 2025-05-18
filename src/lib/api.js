// Simulated API endpoints with delay to mimic real API calls

// Helper function to simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' },
  { id: 4, name: 'Alice Williams', email: 'alice@example.com', role: 'editor' },
  { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
];

const posts = [
  { id: 1, title: 'Introduction to React', author: 1, content: 'React is a JavaScript library for building user interfaces.' },
  { id: 2, title: 'Async/Await in JavaScript', author: 2, content: 'Async/await is a way to handle promises in a more elegant way.' },
  { id: 3, title: 'React Hooks', author: 1, content: 'Hooks are a new addition in React 16.8 that let you use state and other React features without writing a class.' },
  { id: 4, title: 'JavaScript Promises', author: 3, content: 'Promises are a way to handle asynchronous operations in JavaScript.' },
  { id: 5, title: 'React Router', author: 4, content: 'React Router is a collection of navigational components that compose declaratively with your application.' },
];

// API functions
export const fetchUsers = async () => {
  await delay(1000); // Simulate network delay
  return [...users];
};

export const fetchUserById = async (id) => {
  await delay(800);
  const user = users.find(user => user.id === id);
  if (!user) {
    throw new Error(`User with id ${id} not found`);
  }
  return { ...user };
};

export const fetchPosts = async () => {
  await delay(1500);
  return [...posts];
};

export const fetchPostsByAuthor = async (authorId) => {
  await delay(1200);
  const authorPosts = posts.filter(post => post.author === authorId);
  return [...authorPosts];
};

export const createPost = async (post) => {
  await delay(1000);
  // Simulate validation
  if (!post.title || !post.content || !post.author) {
    throw new Error('Title, content, and author are required');
  }
  const newPost = {
    id: posts.length + 1,
    ...post
  };
  // In a real app, we would add to the database
  // posts.push(newPost);
  return newPost;
};

// Simulated API call that will fail
export const unreliableAPICall = async () => {
  await delay(1500);
  // Randomly succeed or fail
  if (Math.random() > 0.5) {
    return { status: 'success', data: 'Operation completed successfully' };
  } else {
    throw new Error('Network error occurred');
  }
}; 