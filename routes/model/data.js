var mongoose = require('mongoose');
var Schema = new mongoose.Schema({
    users: Number
});

module.exports = mongoose.model('data', Schema);