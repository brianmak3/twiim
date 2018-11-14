var mongoose = require('mongoose');
var Schema = new mongoose.Schema({
    _id: Number,
    quiz: String,
    by: {
    	name: String,
    	id: Number
    },
    comments:[{
    	comment: String,
    	_id: Number,
    	by: {
	    	name: String,
	    	id: Number
       }                                                            
    }]
});

module.exports = mongoose.model('faq', Schema);