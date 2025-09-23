const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const ordersRoutes = require('./routes/orderRoutes');
const userSummaryRoutes = require('./controllers/userController');
const cors = require('cors');
dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());
// Routes
app.use("/api/auth", require("./routes/authRoutes"));
// Catalogue routes
app.use('/api/esimgo', require('./routes/catalogueRoutes'));
app.use("/api/countries", require("./routes/countriesRoutes"));
app.use('/api/regions', require('./routes/regionsRoutes'));
app.use('/api/users', userSummaryRoutes);
// Routes
app.use('/api/orders', ordersRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));