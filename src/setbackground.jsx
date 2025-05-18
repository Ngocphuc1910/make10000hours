import React from 'react';
import { useTheme } from './ThemeContext'; // Import the custom hook

export default function ColorPicker() {
  const { theme, changeTheme } = useTheme(); // Use the context
  
  // Ensure the style is properly applied with appropriate properties
  const divStyle = {
    backgroundColor: theme.color,
    padding: '20px',
    borderRadius: '8px',
    margin: '10px',
    minHeight: '200px',
    color: 'black' // For better contrast with colored backgrounds
  };
  
  return (
    <div style={divStyle}>
      <p>The color is {theme.color}</p>
      <button onClick={() => changeTheme("Aquamarine")}>Aquamarine</button>
      <button onClick={() => changeTheme("BlueViolet")}>BlueViolet</button>
      <button onClick={() => changeTheme("Chartreuse")}>Chartreuse</button>
      <button onClick={() => changeTheme("CornflowerBlue")}>CornflowerBlue</button>
    </div>
  );
}

// Bên ngoài I mean là cái <button> Aquamarine</button> sẽ là quyết định nó hiển thị như thế nào.
//Bên trong cái setColor("Aquamarine") dùng để gắn các giá trí cho thằng setColor khi mà bấm vào button đó.