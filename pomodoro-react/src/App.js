import React from 'react';
import './styles/globals.css';
import Header from './components/Header';

function App() {
  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <Header />
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 text-center">Pomodoro Timer</h1>
        
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="text-center mb-4">
            <h2 className="text-lg font-medium">Focus Session</h2>
          </div>
          
          <div className="text-center mb-8">
            <div className="text-7xl font-bold tracking-tighter">
              25:00
            </div>
          </div>
          
          <div className="flex justify-center space-x-4">
            <button className="w-12 h-12 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 ml-0.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            
            <button className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9.14 2.331c-.102-.359.498-.513.64-.196l3.516 7.88 8.214 1.193c.396.058.553.557.267.843l-5.936 5.786 1.4 8.173c.067.393-.344.694-.696.507l-7.348-3.867-7.348 3.867c-.352.187-.763-.114-.696-.507l1.4-8.173L.631 12.05c-.285-.285-.129-.784.267-.842l8.214-1.194L12.628 2.14c.102-.228.36-.349.602-.33.083.007.166.04.235.098l-.235-.099c.111.053.202.144.255.255l-.255-.255c.118.05.216.143.267.273l-.356-.18c.042.169.206.288.379.306l-.023-.368z" strokeWidth="0" fill="currentColor"></path></svg>
            </button>
          </div>
        </div>
        
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
          <h2 className="font-semibold text-lg mb-4">Current Task</h2>
          <div className="mb-4">
            <p className="text-gray-700">Complete UI Development</p>
          </div>
          <div className="flex">
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Work</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 