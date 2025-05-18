import { create } from 'zustand';
import { 
  getProducts, 
  getProductById, 
  getOrders, 
  getUserOrders, 
  getOrderDetails,
  checkoutOrder,
  searchProducts,
  unreliableOperation
} from './promiseApi';

// Store to manage all Promise-based operations
const usePromiseStore = create((set, get) => ({
  // State
  products: [],
  orders: [],
  currentProduct: null,
  userOrders: [],
  orderDetails: null,
  searchResults: [],
  cart: [],
  isLoading: false,
  error: null,
  
  // Actions
  fetchProducts: () => {
    set({ isLoading: true, error: null });
    
    return getProducts()
      .then(products => {
        set({ products, isLoading: false });
        return products;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  fetchProductById: (id) => {
    set({ isLoading: true, error: null });
    
    return getProductById(id)
      .then(product => {
        set({ currentProduct: product, isLoading: false });
        return product;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  fetchOrders: () => {
    set({ isLoading: true, error: null });
    
    return getOrders()
      .then(orders => {
        set({ orders, isLoading: false });
        return orders;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  fetchUserOrders: (userId) => {
    set({ isLoading: true, error: null });
    
    return getUserOrders(userId)
      .then(userOrders => {
        set({ userOrders, isLoading: false });
        return userOrders;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  fetchOrderDetails: (orderId) => {
    set({ isLoading: true, error: null });
    
    return getOrderDetails(orderId)
      .then(details => {
        set({ orderDetails: details, isLoading: false });
        return details;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  searchForProducts: (query) => {
    set({ isLoading: true, error: null });
    
    return searchProducts(query)
      .then(results => {
        set({ searchResults: results, isLoading: false });
        return results;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  // Cart management
  addToCart: (product, quantity = 1) => {
    const { cart } = get();
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      // Update quantity of existing item
      const updatedCart = cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + quantity } 
          : item
      );
      set({ cart: updatedCart });
    } else {
      // Add new item
      set({ cart: [...cart, { productId: product.id, name: product.name, price: product.price, quantity }] });
    }
  },
  
  removeFromCart: (productId) => {
    const { cart } = get();
    set({ cart: cart.filter(item => item.productId !== productId) });
  },
  
  updateCartItemQuantity: (productId, quantity) => {
    const { cart } = get();
    if (quantity <= 0) {
      set({ cart: cart.filter(item => item.productId !== productId) });
    } else {
      set({ 
        cart: cart.map(item => 
          item.productId === productId 
            ? { ...item, quantity } 
            : item
        )
      });
    }
  },
  
  clearCart: () => {
    set({ cart: [] });
  },
  
  // Checkout process
  checkout: (userData) => {
    const { cart } = get();
    set({ isLoading: true, error: null });
    
    return checkoutOrder(cart, userData)
      .then(result => {
        // On successful checkout, clear the cart
        set({ cart: [], isLoading: false });
        return result;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  // Unreliable operation demo
  tryUnreliableOperation: () => {
    set({ isLoading: true, error: null });
    
    return unreliableOperation()
      .then(result => {
        set({ isLoading: false });
        return result;
      })
      .catch(error => {
        set({ error: error.message, isLoading: false });
        throw error;
      });
  },
  
  resetError: () => set({ error: null })
}));

export default usePromiseStore; 