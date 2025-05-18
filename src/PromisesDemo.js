import React, { useState, useEffect } from 'react';

const PromisesDemo = () => {
  // Local state
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [promiseResult, setPromiseResult] = useState(null);
  
  // Mock API functions
  const fetchProducts = () => {
    setIsLoading(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockProducts = [
          { id: 1, name: 'Laptop', price: 999, category: 'Electronics' },
          { id: 2, name: 'Headphones', price: 199, category: 'Electronics' },
          { id: 3, name: 'Coffee Maker', price: 89, category: 'Kitchen' },
          { id: 4, name: 'Running Shoes', price: 79, category: 'Sports' },
          { id: 5, name: 'Desk Chair', price: 249, category: 'Furniture' }
        ];
        setProducts(mockProducts);
        setIsLoading(false);
        resolve(mockProducts);
      }, 1000);
    });
  };
  
  const fetchOrders = () => {
    setIsLoading(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockOrders = [
          { id: 1, total: 1287, status: 'Delivered' },
          { id: 2, total: 199, status: 'Processing' },
          { id: 3, total: 368, status: 'Shipped' }
        ];
        setOrders(mockOrders);
        setIsLoading(false);
        resolve(mockOrders);
      }, 1000);
    });
  };

  const tryUnreliableOperation = () => {
    setIsLoading(true);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 60% chance of success, 40% chance of failure
        const isSuccess = Math.random() > 0.4;
        
        if (isSuccess) {
          setIsLoading(false);
          resolve({ message: 'Operation completed successfully!' });
        } else {
          setError('The operation failed randomly');
          setIsLoading(false);
          reject(new Error('Random failure occurred'));
        }
      }, 1000);
    });
  };
  
  // Fetch initial products when component mounts
  useEffect(() => {
    fetchProducts()
      .catch(err => {
        setError(err.message);
      });
  }, []);
  
  // Handle Promise.all demo
  const handlePromiseAll = () => {
    setIsLoading(true);
    const startTime = performance.now();
    
    // Run multiple API calls in parallel
    Promise.all([fetchProducts(), fetchOrders()])
      .then(([productsResult, ordersResult]) => {
        const endTime = performance.now();
        setPromiseResult({
          method: 'Promise.all',
          time: endTime - startTime,
          message: `Loaded ${productsResult.length} products and ${ordersResult.length} orders in parallel`
        });
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  };
  
  // Handle Promise chain demo
  const handlePromiseChain = () => {
    setIsLoading(true);
    const startTime = performance.now();
    
    // Run API calls sequentially
    fetchProducts()
      .then(productsResult => {
        return fetchOrders().then(ordersResult => {
          return { productsResult, ordersResult };
        });
      })
      .then(results => {
        const endTime = performance.now();
        setPromiseResult({
          method: 'Promise chain',
          time: endTime - startTime,
          message: `Loaded ${results.productsResult.length} products then ${results.ordersResult.length} orders sequentially`
        });
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  };
  
  // Handle error demo
  const handleErrorDemo = () => {
    tryUnreliableOperation()
      .then(result => {
        alert(`Success: ${result.message}`);
      })
      .catch(err => {
        // Error is already set in state
        console.error('Operation failed:', err);
      });
  };
  
  // Reset error state
  const resetError = () => {
    setError(null);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>JavaScript Promises Demo</h1>
      
      {/* Loading and Error States */}
      {isLoading && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
          Loading...
        </div>
      )}
      
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffeeee', color: 'red', marginBottom: '20px' }}>
          <p><strong>Error:</strong> {error}</p>
          <button 
            onClick={resetError}
            style={{ padding: '5px 10px' }}
          >
            Clear Error
          </button>
        </div>
      )}
      
      {/* Basic Promises Demo */}
      <div style={{ padding: '15px', border: '1px solid #ddd', marginBottom: '20px' }}>
        <h2>Promises Basics</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={fetchProducts}
            style={{ padding: '8px 12px' }}
          >
            Fetch Products
          </button>
          
          <button
            onClick={fetchOrders}
            style={{ padding: '8px 12px' }}
          >
            Fetch Orders
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <h3>Products ({products.length})</h3>
            <ul>
              {products.map(product => (
                <li key={product.id}>
                  <strong>{product.name}</strong> - ${product.price}
                </li>
              ))}
            </ul>
          </div>
          
          <div style={{ flex: 1 }}>
            <h3>Orders ({orders.length})</h3>
            <ul>
              {orders.map(order => (
                <li key={order.id}>
                  <strong>Order #{order.id}</strong> - ${order.total} ({order.status})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Advanced Promises Demo */}
      <div style={{ padding: '15px', border: '1px solid #ddd', marginBottom: '20px' }}>
        <h2>Advanced Promise Methods</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={handlePromiseAll}
            style={{ padding: '8px 12px' }}
          >
            Run Promise.all
          </button>
          
          <button
            onClick={handlePromiseChain}
            style={{ padding: '8px 12px' }}
          >
            Run Promise Chain
          </button>
          
          <button
            onClick={handleErrorDemo}
            style={{ padding: '8px 12px', backgroundColor: '#ffeeee' }}
          >
            Test Error Handling
          </button>
        </div>
        
        {promiseResult && (
          <div style={{ padding: '10px', backgroundColor: '#f0f9ff', marginTop: '15px' }}>
            <h3>Result: {promiseResult.method}</h3>
            <p><strong>Execution Time:</strong> {promiseResult.time.toFixed(2)}ms</p>
            <p>{promiseResult.message}</p>
          </div>
        )}
      </div>
      
      {/* How Promises Work */}
      <div style={{ padding: '15px', border: '1px solid #ddd' }}>
        <h2>How Promises Work</h2>
        
        <p>
          A <strong>Promise</strong> is an object representing the eventual completion or failure 
          of an asynchronous operation.
        </p>
        
        <h3>Promise States:</h3>
        <ul>
          <li><strong>Pending:</strong> Initial state</li>
          <li><strong>Fulfilled:</strong> Operation completed successfully</li>
          <li><strong>Rejected:</strong> Operation failed</li>
        </ul>
        
        <h3>Key Promise Methods:</h3>
        <ul>
          <li><strong>then():</strong> Called when a Promise is resolved</li>
          <li><strong>catch():</strong> Called when a Promise is rejected</li>
          <li><strong>Promise.all():</strong> Wait for all Promises to resolve in parallel</li>
        </ul>
      </div>
    </div>
  );
};

export default PromisesDemo; 