import React, { useState, useEffect, Component } from 'react';

// =============================================================
// PART 1: MODERN APPROACH - FUNCTIONAL COMPONENTS WITH HOOKS
// =============================================================

// Child component to demonstrate mounting and unmounting
function ChildComponent({ count, onIncrement }) {
  // MOUNTING PHASE: This runs when the component mounts
  useEffect(() => {
    console.log('ChildComponent MOUNTED');
    
    // UNMOUNTING PHASE: This cleanup function runs when the component unmounts
    return () => {
      console.log('ChildComponent UNMOUNTED');
    };
  }, []);
  
  // UPDATING PHASE: This runs when count prop changes
  useEffect(() => {
    console.log('ChildComponent UPDATED because count changed');
  }, [count]);
  
  return (
    <div style={{ 
      border: '1px solid #ccc', 
      padding: '15px', 
      margin: '10px 0',
      backgroundColor: '#f8f9fa'
    }}>
      <h3>Child Component</h3>
      <p>Count from parent: {count}</p>
      <button onClick={onIncrement}>Increment from Child</button>
    </div>
  );
}

// Main Hooks-based component demonstrating lifecycle
function FunctionalLifecycle() {
  const [count, setCount] = useState(0);
  const [showChild, setShowChild] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState('#fff');
  
  // MOUNTING PHASE: Runs once when component mounts
  useEffect(() => {
    console.log('FunctionalLifecycle MOUNTED');
    
    // Optional: Simulate componentWillUnmount
    return () => {
      console.log('FunctionalLifecycle UNMOUNTED');
    };
  }, []);
  
  // UPDATING PHASE: Runs when count changes
  useEffect(() => {
    console.log('FunctionalLifecycle UPDATED because count changed');
    document.title = `Count: ${count}`;
    
    // Change background color based on count
    setBackgroundColor(count % 2 === 0 ? '#f0f8ff' : '#fff0f5');
  }, [count]);
  
  // UPDATING PHASE: Runs on EVERY render
  useEffect(() => {
    console.log('FunctionalLifecycle RENDERED');
  });
  
  return (
    <div style={{ padding: '20px', backgroundColor }}>
      <h2>Functional Component Lifecycle</h2>
      <p>Current count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment Count
      </button>
      <button onClick={() => setShowChild(!showChild)} style={{ marginLeft: '10px' }}>
        {showChild ? 'Hide' : 'Show'} Child Component
      </button>
      
      {showChild && (
        <ChildComponent 
          count={count} 
          onIncrement={() => setCount(count + 1)} 
        />
      )}
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <p>Open browser console to see lifecycle logs!</p>
      </div>
    </div>
  );
}

// =============================================================
// PART 2: TRADITIONAL APPROACH - CLASS COMPONENTS
// =============================================================

// Class-based Child Component
class ClassChildComponent extends Component {
  // MOUNTING PHASE
  componentDidMount() {
    console.log('ClassChildComponent MOUNTED');
  }
  
  // UPDATING PHASE
  componentDidUpdate(prevProps) {
    if (prevProps.count !== this.props.count) {
      console.log('ClassChildComponent UPDATED - count changed');
    }
  }
  
  // UNMOUNTING PHASE
  componentWillUnmount() {
    console.log('ClassChildComponent UNMOUNTED');
  }
  
  render() {
    return (
      <div style={{ 
        border: '1px solid #ccc', 
        padding: '15px', 
        margin: '10px 0',
        backgroundColor: '#f8f9fa'
      }}>
        <h3>Class Child Component</h3>
        <p>Count from parent: {this.props.count}</p>
        <button onClick={this.props.onIncrement}>Increment from Child</button>
      </div>
    );
  }
}

// Main Class-based Component
class ClassLifecycle extends Component {
  constructor(props) {
    super(props);
    this.state = {
      count: 0,
      showChild: true,
      backgroundColor: '#fff'
    };
    
    console.log('ClassLifecycle CONSTRUCTOR - Initial setup');
  }
  
  // MOUNTING PHASE
  componentDidMount() {
    console.log('ClassLifecycle MOUNTED - Component is now in DOM');
    // Common uses: API calls, DOM manipulation, subscriptions
  }
  
  // UPDATING PHASE
  static getDerivedStateFromProps(props, state) {
    console.log('ClassLifecycle getDerivedStateFromProps');
    // Rarely used method: Return new state or null
    return null;
  }
  
  shouldComponentUpdate(nextProps, nextState) {
    console.log('ClassLifecycle shouldComponentUpdate - Decide whether to render');
    // Optimization method: Return true to render, false to skip
    return true;
  }
  
  getSnapshotBeforeUpdate(prevProps, prevState) {
    console.log('ClassLifecycle getSnapshotBeforeUpdate - Get DOM info before update');
    // Rarely used: Return value to be passed to componentDidUpdate
    return null;
  }
  
  componentDidUpdate(prevProps, prevState, snapshot) {
    console.log('ClassLifecycle UPDATED - Component re-rendered');
    
    if (prevState.count !== this.state.count) {
      console.log('Count changed, updating document title');
      document.title = `Count: ${this.state.count}`;
      
      // Update background color based on count
      this.setState({
        backgroundColor: this.state.count % 2 === 0 ? '#f0f8ff' : '#fff0f5'
      });
    }
  }
  
  // UNMOUNTING PHASE
  componentWillUnmount() {
    console.log('ClassLifecycle UNMOUNTED - Component removed from DOM');
    // Common uses: Clean up subscriptions, timers, etc.
  }
  
  handleIncrement = () => {
    this.setState({ count: this.state.count + 1 });
  };
  
  toggleChild = () => {
    this.setState({ showChild: !this.state.showChild });
  };
  
  render() {
    console.log('ClassLifecycle RENDER');
    
    return (
      <div style={{ padding: '20px', backgroundColor: this.state.backgroundColor }}>
        <h2>Class Component Lifecycle</h2>
        <p>Current count: {this.state.count}</p>
        <button onClick={this.handleIncrement}>
          Increment Count
        </button>
        <button onClick={this.toggleChild} style={{ marginLeft: '10px' }}>
          {this.state.showChild ? 'Hide' : 'Show'} Child Component
        </button>
        
        {this.state.showChild && (
          <ClassChildComponent 
            count={this.state.count} 
            onIncrement={this.handleIncrement} 
          />
        )}
        
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
          <p>Open browser console to see lifecycle logs!</p>
        </div>
      </div>
    );
  }
}

// Main component combining both approaches
function LifecycleExample() {
  const [showClassVersion, setShowClassVersion] = useState(false);
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>React Component Lifecycle Examples</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setShowClassVersion(!showClassVersion)}
          style={{
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Switch to {showClassVersion ? 'Hooks' : 'Class'} Example
        </button>
      </div>
      
      {showClassVersion ? <ClassLifecycle /> : <FunctionalLifecycle />}
      
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#f0f0f0',
        borderRadius: '5px'
      }}>
        <h3>React Component Lifecycle Summary:</h3>
        
        <h4>Mounting Phase:</h4>
        <ul>
          <li>Class: constructor → getDerivedStateFromProps → render → componentDidMount</li>
          <li>Hooks: useEffect(() {'=>'} {'{...}'}, []) - empty dependency array</li>
        </ul>
        
        <h4>Updating Phase:</h4>
        <ul>
          <li>Class: getDerivedStateFromProps → shouldComponentUpdate → render → getSnapshotBeforeUpdate → componentDidUpdate</li>
          <li>Hooks: useEffect(() {'=>'} {'{...}'}, [dependencies]) - with dependency array</li>
        </ul>
        
        <h4>Unmounting Phase:</h4>
        <ul>
          <li>Class: componentWillUnmount</li>
          <li>Hooks: useEffect(() {'=>'} {'{ return () => {...} }'}, []) - cleanup function</li>
        </ul>
      </div>
    </div>
  );
}

export default LifecycleExample; 