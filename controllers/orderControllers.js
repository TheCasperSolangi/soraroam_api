const Orders = require('../models/Order');
// Get all orders (admin or global)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Orders.find();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found.' });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Server error while fetching all orders.' });
  }
};

// Get all orders for a specific user
exports.getOrderByUser = async (req, res) => {
  try {
    const { username } = req.params;
    const orders = await Orders.find({ username });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this user.' });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders.' });
  }
};

// Get a specific order by order_code
exports.getSpecificOrder = async (req, res) => {
  try {
    const { order_code } = req.params;
    const order = await Orders.findOne({ order_code });

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.status(200).json({ order });
  } catch (error) {
    console.error('Error fetching specific order:', error);
    res.status(500).json({ message: 'Server error while fetching order.' });
  }
};

// Get all orders for a specific user by email
exports.getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const orders = await Orders.find({ customerEmail: email.toLowerCase().trim() });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this email.' });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching orders by email:', error);
    res.status(500).json({ message: 'Server error while fetching orders by email.' });
  }
};