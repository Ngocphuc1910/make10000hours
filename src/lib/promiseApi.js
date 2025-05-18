// Promise-based API functions to demonstrate different aspects of Promises

// Helper function to simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const products = [
  { id: 1, name: 'Smartphone', price: 699, category: 'Electronics', stock: 25 },
  { id: 2, name: 'Laptop', price: 1299, category: 'Electronics', stock: 12 },
  { id: 3, name: 'Headphones', price: 149, category: 'Electronics', stock: 50 },
  { id: 4, name: 'Running Shoes', price: 89, category: 'Footwear', stock: 30 },
  { id: 5, name: 'T-shirt', price: 19, category: 'Clothing', stock: 100 },
  { id: 6, name: 'Coffee Maker', price: 79, category: 'Kitchen', stock: 15 },
  { id: 7, name: 'Fitness Tracker', price: 49, category: 'Electronics', stock: 20 },
  { id: 8, name: 'Desk Chair', price: 199, category: 'Furniture', stock: 8 }
];

const orders = [
  { id: 1, userId: 1, products: [1, 3], total: 848, status: 'delivered' },
  { id: 2, userId: 2, products: [2], total: 1299, status: 'processing' },
  { id: 3, userId: 1, products: [4, 5], total: 108, status: 'shipped' },
  { id: 4, userId: 3, products: [6], total: 79, status: 'processing' }
];

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' }
];

// Promise-based API functions
export const getProducts = () => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      resolve([...products]);
    }, 1000);
  });
};

export const getProductById = (id) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const product = products.find(p => p.id === id);
      if (product) {
        resolve({ ...product });
      } else {
        reject(new Error(`Product with id ${id} not found`));
      }
    }, 800);
  });
};

export const getOrders = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve([...orders]);
    }, 1200);
  });
};

export const getUserOrders = (userId) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const userOrders = orders.filter(order => order.userId === userId);
      resolve([...userOrders]);
    }, 1500);
  });
};

export const getOrderDetails = (orderId) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        reject(new Error(`Order with id ${orderId} not found`));
        return;
      }
      
      // Get the user
      const user = users.find(u => u.id === order.userId);
      if (!user) {
        reject(new Error(`User for order ${orderId} not found`));
        return;
      }
      
      // Get the products
      const orderProducts = order.products.map(productId => 
        products.find(p => p.id === productId)
      );
      
      if (orderProducts.includes(undefined)) {
        reject(new Error('Some products in the order were not found'));
        return;
      }
      
      resolve({
        ...order,
        user: { ...user },
        products: orderProducts
      });
    }, 2000);
  });
};

export const checkoutOrder = (cartItems, userData) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Validate input
      if (!cartItems || cartItems.length === 0) {
        reject(new Error('Cart cannot be empty'));
        return;
      }
      
      if (!userData || !userData.name || !userData.email) {
        reject(new Error('User information is required'));
        return;
      }
      
      // Check if all products exist and are in stock
      for (const item of cartItems) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          reject(new Error(`Product with id ${item.productId} not found`));
          return;
        }
        
        if (product.stock < item.quantity) {
          reject(new Error(`Not enough ${product.name} in stock. Only ${product.stock} available.`));
          return;
        }
      }
      
      // Calculate total
      let total = 0;
      const purchasedProductIds = [];
      
      cartItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        total += product.price * item.quantity;
        purchasedProductIds.push(item.productId);
      });
      
      // Create a new order
      const newOrder = {
        id: orders.length + 1,
        userId: userData.id || 1, // Default to user 1 if not provided
        products: purchasedProductIds,
        total,
        status: 'processing'
      };
      
      // In a real app, we would save to database
      // orders.push(newOrder);
      
      resolve({
        order: newOrder,
        message: 'Order placed successfully!'
      });
    }, 1800);
  });
};

export const searchProducts = (query) => {
  return new Promise((resolve, reject) => {
    if (!query || query.trim() === '') {
      reject(new Error('Search query cannot be empty'));
      return;
    }
    
    setTimeout(() => {
      const normalizedQuery = query.toLowerCase();
      const results = products.filter(product => 
        product.name.toLowerCase().includes(normalizedQuery) || 
        product.category.toLowerCase().includes(normalizedQuery)
      );
      
      resolve(results);
    }, 1000);
  });
};

// Demo of a Promise that occasionally fails randomly
export const unreliableOperation = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.6) {
        resolve({ success: true, message: 'Operation completed successfully' });
      } else {
        reject(new Error('The operation failed due to a network error. Please try again.'));
      }
    }, 1500);
  });
}; 