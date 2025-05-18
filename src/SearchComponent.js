import React, { useState, useCallback, useEffect } from 'react';
import useInput from './useInput';

function SearchComponent() {
  const searchInput = useInput('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Sample data
  const items = [
    { id: 1, name: 'React Hooks' },
    { id: 2, name: 'useState Hook' },
    { id: 3, name: 'useEffect Hook' },
    { id: 4, name: 'useContext Hook' },
    { id: 5, name: 'useReducer Hook' },
    { id: 6, name: 'useCallback Hook' },
    { id: 7, name: 'useMemo Hook' },
    { id: 8, name: 'useRef Hook' },
    { id: 9, name: 'Custom Hooks' },
    { id: 10, name: 'React Router' },
  ];
  
  // Memoized search function with useCallback
  const performSearch = useCallback((term) => {
    console.log('Searching for:', term);
    return items.filter(item => 
      item.name.toLowerCase().includes(term.toLowerCase())
    );
  }, []);
  
  // Memoized item click handler
  const handleItemClick = useCallback((item) => {
    console.log('Item clicked:', item.name);
    setSelectedItem(item);
  }, []);
  
  // Update search results when search term changes
  useEffect(() => {
    // Show all items when search is empty, otherwise filter
    const results = searchInput.value === '' ? items : performSearch(searchInput.value);
    setSearchResults(results);
  }, [searchInput.value, performSearch]);
  
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Search with useCallback</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchInput.value}
          onChange={searchInput.handleChange}
          placeholder="Search hooks..."
          style={{ width: '100%', padding: '10px', fontSize: '16px' }}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h2>Search Results ({searchResults.length})</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {searchResults.map(item => (
              <li 
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  padding: '10px',
                  margin: '5px 0',
                  backgroundColor: selectedItem?.id === item.id ? '#e6f7ff' : '#f5f5f5',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </li>
            ))}
          </ul>
          
          {searchResults.length === 0 && (
            <p style={{ color: '#888' }}>No results found</p>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <h2>Selected Item</h2>
          {selectedItem ? (
            <div style={{ padding: '15px', backgroundColor: '#e6f7ff', borderRadius: '4px' }}>
              <h3>{selectedItem.name}</h3>
              <p>ID: {selectedItem.id}</p>
            </div>
          ) : (
            <p style={{ color: '#888' }}>No item selected</p>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>How useCallback Works in this Example:</h3>
        <p>1. The <code>performSearch</code> function is wrapped with useCallback, so it doesn't get recreated on every render</p>
        <p>2. We safely use this function in the useEffect dependency array without causing infinite loops</p>
        <p>3. The <code>handleItemClick</code> function is also memoized, preventing unnecessary re-renders when passed to child components</p>
        <p>4. Without useCallback, these functions would be recreated on every render, potentially causing performance issues</p>
      </div>
      
      <button
        onClick={() => {
          searchInput.handleChange({ target: { value: '' } });
          setSelectedItem(null);
        }}
        style={{
          marginTop: '15px',
          padding: '10px 20px',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Clear
      </button>
    </div>
  );
}

export default SearchComponent;