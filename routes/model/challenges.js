var mongoose = require('mongoose');
var chalSchema = new mongoose.Schema({
   name: String,
   startDate: String,
   startTime: String,
   endDate: String,
   endTime: String,
   question: String,
   answer: String,
   Options:[{
       title: String,
       value: String,
       coins: String
    }],
   id: Number,
    betters: [{
       userId: Number,
        options: [{
           value: String,
            coinsPlaced: Number,
            possibleWin: Number
        }]
    }],
    optionsTotal: Number,
    type: String
});

module.exports = mongoose.model('challenges', chalSchema);