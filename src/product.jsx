import React from 'react';
import { Link } from 'react-router-dom';

function Product(props) {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>{props.name}</h1>
      <h2>${props.price}</h2>
      <h3>Rating: {props.rating}</h3>
      <div style={{ marginTop: '20px' }}>
        <Link to="/">Back to Home</Link>
      </div>
    </div>       
  )
}

// Default props in case no props are provided in the route
Product.defaultProps = {
  name: "iPhone 13",
  price: 500,
  rating: "4.9/5.0"
};

export default Product;