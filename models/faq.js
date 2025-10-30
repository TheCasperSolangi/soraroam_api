const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    question: {type:String, required: true},
    answer: {type:String, required: true},
    visibility: {type:String, required: true, enum: ["YES", "NO"]}
});

module.exports = mongoose.model('FAQs', faqSchema);