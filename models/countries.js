// countries.js
const mongoose = require('mongoose');

const countriesSchema = new mongoose.Schema({
    country_code: { type: String, required: true },
    country_name: { type: String, required: true },
    country_flag_picture: { type: String, required: true },
    country_description: { type: String, required: true },
    country_short_desc: { type: String, required: true },
    country_cover_picture: { type: String, required: true },
    region_code: { type: String, required: true } // keep as string
});

module.exports = mongoose.model('Countries', countriesSchema);