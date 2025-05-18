import React from 'react';

const Card = ({ title, children, isLoading, error, footerContent }) => {
  return (
    <div className="card" style={{ 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '15px',
      margin: '10px 0',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      backgroundColor: '#fff',
      maxWidth: '100%'
    }}>
      {title && (
        <div className="card-header" style={{ 
          borderBottom: '1px solid #eee', 
          marginBottom: '15px',
          paddingBottom: '10px'
        }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>
      )}
      
      {isLoading && (
        <div className="loading-indicator" style={{ 
          padding: '20px', 
          textAlign: 'center',
          color: '#666'
        }}>
          Loading...
        </div>
      )}
      
      {error && (
        <div className="error-message" style={{ 
          padding: '10px',
          backgroundColor: '#ffeeee',
          border: '1px solid #ffcccc',
          borderRadius: '4px',
          color: '#cc0000',
          marginBottom: '15px'
        }}>
          {error}
        </div>
      )}
      
      <div className="card-body">
        {children}
      </div>
      
      {footerContent && (
        <div className="card-footer" style={{ 
          borderTop: '1px solid #eee', 
          marginTop: '15px',
          paddingTop: '10px'
        }}>
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default Card; 