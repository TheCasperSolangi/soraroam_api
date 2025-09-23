const mongoose = require('mongoose');

const regionsSchema = new mongoose.Schema({
    region_code: {type:String, required: true},
    region_name: {type:String, required: true},
    region_description: {type:String, required: true},
    region_flag: {type:String, required: true},
    region_cover_picture: {type:String, required: true}
    
});

module.exports = mongoose.model('Regions', regionsSchema);