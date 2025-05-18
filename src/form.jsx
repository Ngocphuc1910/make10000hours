import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import useInput from './useInput';

function Input() {
  const [userInput, setUserInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [message, setMessage] = useState('');
  const [typingTimer, setTypingTimer] = useState(null);
  
  // Add a useRef to track previous input value
  const previousInputValue = useRef('');
  
  const handleUserInput = (e) => {
    // Store the current value as the previous value BEFORE updating state
    previousInputValue.current = userInput;
    // Then update the state with the new value
    setUserInput(e.target.value);
  };

  // useEffect to validate email input
  useEffect(() => {
    // Clear previous timer
    if (typingTimer) {
      clearTimeout(typingTimer);
    }
    
    // Don't validate if the input is empty
    if (!userInput) {
      setIsValid(true);
      setMessage('');
      return;
    }
    
    // Set a new timer to validate after user stops typing for 500ms
    const timer = setTimeout(() => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const valid = emailRegex.test(userInput);
      
      setIsValid(valid);
      
      if (valid) {
        setMessage('Email is valid!');
      } else {
        setMessage('Please enter a valid email address');
      }
    }, 1000);
    
    setTypingTimer(timer);
    
    // Cleanup function to clear the timer when component unmounts or when userInput changes
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [userInput]); // This effect runs whenever userInput changes
  
  // Remove the useEffect that was updating the ref
  // since we're now updating it before the state change

  return (
    <>
      <div className="emailContainer">
        <h2>Let's stay in touch.</h2>
        <p>Sign up for our newsletter to stay up-to-date on the latest products, receive exclusive discounts, and connect with other programmers who share your passion for all things tech.</p>
        <form>
          <label htmlFor="email">Email: </label>
          <input 
            id="email" 
            type="text" 
            onChange={handleUserInput} 
            value={userInput}
            className={!isValid && userInput ? "invalid-input" : ""}
          />
          {userInput && (
            <p className={isValid ? "valid-message" : "error-message"}>
              {message}
            </p>
          )}
        </form>
      </div>
      <div className="inputDisplay">
        <h2>Current User Input: </h2>
        <h4>{userInput}</h4>
        
        {/* Display previous input value */}
        <h2>Previous User Input: </h2>
        <h4>{previousInputValue.current}</h4>
        
        {/* Update explanation about useRef */}
        <div style={{ margin: '20px 0', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <h3>useRef Explanation:</h3>
          <p>The previous value is stored using useRef. Unlike state variables, updating a ref doesn't cause re-renders.</p>
          <p>We update the ref <strong>before</strong> updating the state in the onChange handler, so it always shows the value from before the most recent change.</p>
          <p>This demonstrates how useRef can maintain values across renders without affecting the rendering cycle itself.</p>
        </div>
      </div>
    </>
  );
}

export default Input;