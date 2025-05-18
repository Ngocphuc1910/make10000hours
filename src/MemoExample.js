import React, { useState, useMemo, useEffect } from 'react';
import useInput from './useInput';

function MemoExample() {
  const [numbers, setNumbers] = useState([10, 20, 30, 40, 50]);
  const [darkMode, setDarkMode] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  const [useMemoEnabled, setUseMemoEnabled] = useState(true);
  
  const multiplierInput = useInput(2);
  
  // Increment render counter on each render
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);
  
  // Expensive calculation function
  const calculateTotal = (nums, mul) => {
    console.log('Calculating total...');
    // Simulate heavy computation
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += 1;
    }
    // Actual calculation
    return nums.reduce((acc, num) => acc + num * mul, 0);
  };
  
  // Version WITH useMemo
  const totalWithMemo = useMemo(() => {
    return calculateTotal(numbers, multiplierInput.value);
  }, [numbers, multiplierInput.value]);
  
  // Version WITHOUT useMemo
  const totalWithoutMemo = calculateTotal(numbers, multiplierInput.value);
  
  // Choose which result to display based on toggle
  const total = useMemoEnabled ? totalWithMemo : totalWithoutMemo;
  
  // Another useMemo example: derived data transformation
  const processedData = useMemo(() => {
    console.log('Processing data...');
    return numbers.map(num => ({
      original: num,
      multiplied: num * multiplierInput.value,
      isEven: (num * multiplierInput.value) % 2 === 0
    }));
  }, [numbers, multiplierInput.value]);
  
  // Add a new random number
  const addNumber = () => {
    const newNumber = Math.floor(Math.random() * 100) + 1;
    setNumbers([...numbers, newNumber]);
  };
  
  // Reset to initial state
  const resetNumbers = () => {
    setNumbers([10, 20, 30, 40, 50]);
    multiplierInput.setValue(2);
  };
  
  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      backgroundColor: darkMode ? '#333' : 'white',
      color: darkMode ? 'white' : 'black',
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      <h1>useMemo Example</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <label style={{ marginRight: '10px' }}>
          <input
            type="checkbox"
            checked={useMemoEnabled}
            onChange={() => setUseMemoEnabled(prev => !prev)}
          />
          useMemo enabled
        </label>
        
        <button
          onClick={() => setDarkMode(prev => !prev)}
          style={{ 
            padding: '5px 15px',
            backgroundColor: darkMode ? '#666' : '#ddd',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Toggle Theme
        </button>
        
        <span style={{ color: darkMode ? '#aaa' : '#888' }}>
          Render count: {renderCount}
        </span>
      </div>
      
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: darkMode ? '#444' : '#f5f5f5',
        borderRadius: '5px'
      }}>
        <h2>Sum Calculator</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            Multiplier: 
            <input
              type="number"
              value={multiplierInput.value}
              onChange={multiplierInput.handleChange}
              style={{ 
                marginLeft: '10px',
                padding: '5px',
                width: '60px',
                backgroundColor: darkMode ? '#555' : 'white',
                color: darkMode ? 'white' : 'black',
                border: darkMode ? '1px solid #777' : '1px solid #ccc'
              }}
            />
          </label>
        </div>
        
        <div>
          <p>Numbers: {numbers.join(', ')}</p>
          <p>Total ({useMemoEnabled ? 'with useMemo' : 'without useMemo'}): <strong>{total}</strong></p>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <button
            onClick={addNumber}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Add Number
          </button>
          
          <button
            onClick={resetNumbers}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
      </div>
      
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: darkMode ? '#444' : '#f5f5f5',
        borderRadius: '5px'
      }}>
        <h2>Processed Data Example</h2>
        
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: darkMode ? '#555' : 'white',
          color: darkMode ? '#eee' : '#333'
        }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: darkMode ? '1px solid #666' : '1px solid #ddd' }}>Original</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: darkMode ? '1px solid #666' : '1px solid #ddd' }}>Multiplied by {multiplierInput.value}</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: darkMode ? '1px solid #666' : '1px solid #ddd' }}>Is Even</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((item, index) => (
              <tr key={index}>
                <td style={{ padding: '8px', borderBottom: darkMode ? '1px solid #666' : '1px solid #ddd' }}>{item.original}</td>
                <td style={{ padding: '8px', borderBottom: darkMode ? '1px solid #666' : '1px solid #ddd' }}>{item.multiplied}</td>
                <td style={{ padding: '8px', borderBottom: darkMode ? '1px solid #666' : '1px solid #ddd' }}>{item.isEven ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: darkMode ? '#444' : '#f0f0f0', 
        borderRadius: '5px' 
      }}>
        <h3>How useMemo Works:</h3>
        <p>1. <strong>Memoization:</strong> useMemo caches the result of the calculation based on dependencies</p>
        <p>2. <strong>Performance:</strong> When toggled off, the expensive calculation runs on every render</p>
        <p>3. <strong>Dependency Array:</strong> The calculation only reruns when numbers or multiplier change</p>
        <p>4. <strong>Use Cases:</strong> Ideal for expensive calculations and complex data transformations</p>
        <p>5. <strong>Theme Toggle:</strong> Changing the theme triggers a render, but doesn't recalculate with useMemo</p>
        
        <div style={{ marginTop: '15px', fontSize: '14px', color: darkMode ? '#aaa' : '#666' }}>
          <p>Try toggling useMemo off, then changing the theme or adding numbers - notice the calculation runs on every render!</p>
          <p>With useMemo enabled, the calculation only runs when its dependencies (numbers or multiplier) change.</p>
        </div>
      </div>
    </div>
  );
}

export default MemoExample; 