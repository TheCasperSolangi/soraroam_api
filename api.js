const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const ordersRoutes = require('./routes/orderRoutes');
const userSummaryRoutes = require('./controllers/userController');
const esimgoPlansRoutes = require('./routes/esimgoPLansRoutes');
const keepgoPlansRoutes = require('./routes/keepgoPlans');
const faqRoutes = require('./routes/faqRoutes');
const exchangeRoutes = require("./routes/exchangeRoutes")
const cors = require('cors');
dotenv.config();
connectDB();
const { initializeCountryPricing } = require('./controllers/catalogueController');
const { initializeKeepgoPricing } = require('./controllers/keepgoController');
const app = express();
app.use(express.json());
app.use(cors());
// Routes
app.use("/api/auth", require("./routes/authRoutes"));
// Catalogue routes
app.use('/api/esimgo', require('./routes/catalogueRoutes'));
app.use("/api/countries", require("./routes/countriesRoutes"));
app.use("/api/exchange", exchangeRoutes);
app.use('/api/regions', require('./routes/regionsRoutes'));
app.use("/api/keepgo", require("./routes/keepgoRoutes"));
app.use('/api/plans/esimgo', esimgoPlansRoutes);
app.use('/api/plans/keepgo', keepgoPlansRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/users', userSummaryRoutes);
// Routes
app.use('/api/orders', ordersRoutes);
initializeCountryPricing();
// Initialize KeepGo pricing on server start
initializeKeepgoPricing();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));