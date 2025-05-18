import { create } from 'zustand';
import { fetchUsers, fetchPosts, fetchUserById, fetchPostsByAuthor, createPost, unreliableAPICall } from './api';

// Create a store to manage all async data
const useDataStore = create((set, get) => ({
  // State
  users: [],
  posts: [],
  currentUser: null,
  isLoading: false,
  error: null,
  
  // Actions
  fetchUsers: async () => {
    try {
      set({ isLoading: true, error: null });
      const users = await fetchUsers();
      set({ users, isLoading: false });
      return users;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchPosts: async () => {
    try {
      set({ isLoading: true, error: null });
      const posts = await fetchPosts();
      set({ posts, isLoading: false });
      return posts;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchUserById: async (id) => {
    try {
      set({ isLoading: true, error: null });
      const user = await fetchUserById(id);
      set({ currentUser: user, isLoading: false });
      return user;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchPostsByAuthor: async (authorId) => {
    try {
      set({ isLoading: true, error: null });
      const authorPosts = await fetchPostsByAuthor(authorId);
      // Update the state but don't overwrite all posts
      set({ isLoading: false });
      return authorPosts;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createNewPost: async (postData) => {
    try {
      set({ isLoading: true, error: null });
      const newPost = await createPost(postData);
      // Add the new post to our posts array
      set(state => ({ 
        posts: [...state.posts, newPost],
        isLoading: false 
      }));
      return newPost;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  tryUnreliableCall: async () => {
    try {
      set({ isLoading: true, error: null });
      const result = await unreliableAPICall();
      set({ isLoading: false });
      return result;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  resetError: () => set({ error: null }),
}));

export default useDataStore; 