const express = require("express");
const { getExchangeRates } = require("../controllers/exchangeController");

const router = express.Router();

router.get("/", getExchangeRates);

module.exports = router;
