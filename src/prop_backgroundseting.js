import React from 'react';
import { useTheme } from './ThemeContext'; // Import the custom hook

const colorNames = ['Aquamarine', 'BlueViolet', 
'Chartreuse', 'CornflowerBlue', 'Thistle', 
'SpringGreen', 'SaddleBrown', 'PapayaWhip', 
'MistyRose'];

export default function ColorPicker2() {
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
      <p>Selected color: {theme.color}</p>
      {colorNames.map((colorName)=>(
        <button 
          onClick={() => changeTheme(colorName)}
          key={colorName}
          style={{ 
            margin: '4px',
            backgroundColor: colorName === theme.color ? colorName : 'white',
            color: colorName === theme.color ? 'white' : 'black',
            border: `2px solid ${colorName}`
          }}>
          {colorName}
        </button>
      ))}
    </div>
  );
}