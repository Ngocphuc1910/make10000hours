import { useState } from 'react';

// 1️⃣ Define the custom hook
function useInput(initialValue) {
  const [value, setValue] = useState('default');

  // Function to update state
  const handleChange = (event) => {
    setValue(event.target.value);
  };

  return { value, handleChange }; // 2️⃣ Return value and handler
}

export default useInput;