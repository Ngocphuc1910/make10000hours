import React, { useState, useEffect } from 'react';
import Card from './components/ui/Card';
import Button from './components/ui/Button';
import useDataStore from './lib/store';

const AsyncAwaitDemo = () => {
  // Local state
  const [authorId, setAuthorId] = useState(1);
  const [newPostData, setNewPostData] = useState({
    title: '',
    content: '',
    author: 1
  });
  const [selectedTab, setSelectedTab] = useState('basic');
  const [authorPosts, setAuthorPosts] = useState([]);
  const [parallelResults, setParallelResults] = useState(null);
  const [sequentialResults, setSequentialResults] = useState(null);
  const [parallelTime, setParallelTime] = useState(null);
  const [sequentialTime, setSequentialTime] = useState(null);
  
  // Get state and actions from our store
  const { 
    users, 
    posts, 
    isLoading, 
    error, 
    fetchUsers, 
    fetchPosts, 
    fetchUserById,
    fetchPostsByAuthor,
    createNewPost,
    tryUnreliableCall,
    resetError
  } = useDataStore();
  
  // Basic fetch on component mount
  useEffect(() => {
    // Immediately invoked async function
    (async () => {
      try {
        // Load initial data
        await fetchUsers();
        await fetchPosts();
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    })();
  }, [fetchUsers, fetchPosts]);

  // Handler to fetch posts by author
  const handleFetchAuthorPosts = async () => {
    try {
      const result = await fetchPostsByAuthor(authorId);
      setAuthorPosts(result);
    } catch (err) {
      console.error('Error fetching author posts:', err);
    }
  };

  // Handler to create a new post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      await createNewPost(newPostData);
      // Reset form
      setNewPostData({
        title: '',
        content: '',
        author: 1
      });
    } catch (err) {
      console.error('Error creating post:', err);
    }
  };

  // Demo of sequential vs parallel async calls
  const runSequentialCalls = async () => {
    const start = performance.now();
    try {
      // Sequential calls - each waits for the previous to complete
      const user1 = await fetchUserById(1);
      const user2 = await fetchUserById(2);
      const user3 = await fetchUserById(3);
      
      setSequentialResults([user1, user2, user3]);
      setSequentialTime(performance.now() - start);
    } catch (err) {
      console.error('Error in sequential calls:', err);
    }
  };

  const runParallelCalls = async () => {
    const start = performance.now();
    try {
      // Parallel calls using Promise.all - all start at the same time
      const results = await Promise.all([
        fetchUserById(1),
        fetchUserById(2),
        fetchUserById(3)
      ]);
      
      setParallelResults(results);
      setParallelTime(performance.now() - start);
    } catch (err) {
      console.error('Error in parallel calls:', err);
    }
  };

  // Error handling with try/catch
  const handleTryUnreliable = async () => {
    try {
      const result = await tryUnreliableCall();
      alert(`Success: ${result.data}`);
    } catch (err) {
      // The error is already set in the store via the action
      console.error('Error in unreliable call:', err);
    }
  };

  // Render helpers for each demo section
  const renderBasicDemo = () => (
    <div>
      <p>This demo shows the basic usage of async/await in React components.</p>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <h4>Users ({users.length})</h4>
          <ul style={{ padding: '0 0 0 20px' }}>
            {users.map(user => (
              <li key={user.id}>
                {user.name} ({user.role})
              </li>
            ))}
          </ul>
        </div>
        
        <div style={{ flex: 1 }}>
          <h4>Posts ({posts.length})</h4>
          <ul style={{ padding: '0 0 0 20px' }}>
            {posts.map(post => (
              <li key={post.id}>
                {post.title}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <h4>Fetch Posts by Author</h4>
      <div style={{ marginBottom: '20px' }}>
        <select 
          value={authorId} 
          onChange={(e) => setAuthorId(Number(e.target.value))}
          style={{ padding: '8px', marginRight: '10px' }}
        >
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        
        <Button onClick={handleFetchAuthorPosts}>
          Fetch Posts
        </Button>
        
        {authorPosts.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h5>Author's Posts:</h5>
            <ul style={{ padding: '0 0 0 20px' }}>
              {authorPosts.map(post => (
                <li key={post.id}>{post.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
  
  const renderFormDemo = () => (
    <div>
      <p>This demo shows using async/await with form submissions.</p>
      
      <form onSubmit={handleCreatePost} style={{ maxWidth: '500px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Title:
          </label>
          <input
            type="text"
            value={newPostData.title}
            onChange={(e) => setNewPostData({ ...newPostData, title: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Content:
          </label>
          <textarea
            value={newPostData.content}
            onChange={(e) => setNewPostData({ ...newPostData, content: e.target.value })}
            style={{ width: '100%', padding: '8px', minHeight: '100px' }}
            required
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Author:
          </label>
          <select
            value={newPostData.author}
            onChange={(e) => setNewPostData({ ...newPostData, author: Number(e.target.value) })}
            style={{ width: '100%', padding: '8px' }}
          >
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        
        <Button type="submit" variant="success">
          Create Post
        </Button>
      </form>
    </div>
  );
  
  const renderOptimizationDemo = () => (
    <div>
      <p>This demo compares sequential vs parallel async operations.</p>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <Button onClick={runSequentialCalls} variant="primary">
          Run Sequential
        </Button>
        
        <Button onClick={runParallelCalls} variant="secondary">
          Run Parallel
        </Button>
      </div>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h4>Sequential Calls</h4>
          {sequentialTime && (
            <p>Time: {sequentialTime.toFixed(2)}ms</p>
          )}
          {sequentialResults && (
            <ul style={{ padding: '0 0 0 20px' }}>
              {sequentialResults.map(user => (
                <li key={user.id}>{user.name}</li>
              ))}
            </ul>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <h4>Parallel Calls</h4>
          {parallelTime && (
            <p>Time: {parallelTime.toFixed(2)}ms</p>
          )}
          {parallelResults && (
            <ul style={{ padding: '0 0 0 20px' }}>
              {parallelResults.map(user => (
                <li key={user.id}>{user.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
  
  const renderErrorDemo = () => (
    <div>
      <p>This demo shows error handling with async/await.</p>
      
      <Button 
        onClick={handleTryUnreliable} 
        variant="danger"
        style={{ marginRight: '10px' }}
      >
        Try Unreliable API
      </Button>
      
      <Button onClick={resetError} variant="secondary">
        Reset Error
      </Button>
      
      <div style={{ marginTop: '20px' }}>
        <p>
          This button calls an API that randomly succeeds or fails. 
          Try clicking it multiple times to see both success and error cases.
        </p>
      </div>
    </div>
  );
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Async/Await in React</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          <button 
            onClick={() => setSelectedTab('basic')}
            style={{
              padding: '10px 15px',
              background: selectedTab === 'basic' ? '#f5f5f5' : 'transparent',
              border: 'none',
              borderBottom: selectedTab === 'basic' ? '2px solid #3498db' : 'none',
              cursor: 'pointer'
            }}
          >
            Basic Usage
          </button>
          <button 
            onClick={() => setSelectedTab('form')}
            style={{
              padding: '10px 15px',
              background: selectedTab === 'form' ? '#f5f5f5' : 'transparent',
              border: 'none',
              borderBottom: selectedTab === 'form' ? '2px solid #3498db' : 'none',
              cursor: 'pointer'
            }}
          >
            Form Submission
          </button>
          <button 
            onClick={() => setSelectedTab('optimization')}
            style={{
              padding: '10px 15px',
              background: selectedTab === 'optimization' ? '#f5f5f5' : 'transparent',
              border: 'none',
              borderBottom: selectedTab === 'optimization' ? '2px solid #3498db' : 'none',
              cursor: 'pointer'
            }}
          >
            Optimization
          </button>
          <button 
            onClick={() => setSelectedTab('error')}
            style={{
              padding: '10px 15px',
              background: selectedTab === 'error' ? '#f5f5f5' : 'transparent',
              border: 'none',
              borderBottom: selectedTab === 'error' ? '2px solid #3498db' : 'none',
              cursor: 'pointer'
            }}
          >
            Error Handling
          </button>
        </div>
      </div>
      
      <Card
        title={
          selectedTab === 'basic' ? 'Basic Async/Await Usage' :
          selectedTab === 'form' ? 'Async Form Submission' :
          selectedTab === 'optimization' ? 'Optimizing Async Calls' : 
          'Error Handling'
        }
        isLoading={isLoading}
        error={error}
        footerContent={
          <div>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Async/await makes asynchronous code look and behave like synchronous code.
            </p>
          </div>
        }
      >
        {selectedTab === 'basic' && renderBasicDemo()}
        {selectedTab === 'form' && renderFormDemo()}
        {selectedTab === 'optimization' && renderOptimizationDemo()}
        {selectedTab === 'error' && renderErrorDemo()}
      </Card>
      
      <Card title="How Async/Await Works">
        <div style={{ lineHeight: '1.6' }}>
          <p>
            <strong>async</strong> functions always return a Promise. When you call an async function, it will 
            process until it encounters an <strong>await</strong>, then it will pause until the awaited Promise resolves.
          </p>
          
          <h4>Key Benefits:</h4>
          <ul>
            <li>Makes asynchronous code look synchronous and easier to understand</li>
            <li>Improves error handling with try/catch blocks</li>
            <li>Makes working with Promises more intuitive</li>
            <li>Can run operations in parallel with Promise.all</li>
          </ul>
          
          <h4>Common Use Cases in React:</h4>
          <ul>
            <li>API calls during component mounting (useEffect)</li>
            <li>Form submissions</li>
            <li>Data fetching in event handlers</li>
            <li>Loading data based on user interactions</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default AsyncAwaitDemo; 