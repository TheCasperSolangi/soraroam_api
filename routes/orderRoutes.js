const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orderControllers');

// Fetch all orders
router.get('/', ordersController.getAllOrders);

// Get all orders for a specific user
router.get('/user/:username', ordersController.getOrderByUser);

// Get a specific order by order_code
router.get('/:order_code', ordersController.getSpecificOrder);

// Fetch orders by customer email
router.get('/email/:email', ordersController.getOrdersByEmail);
module.exports = router;