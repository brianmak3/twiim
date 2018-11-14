var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var userSchema = new mongoose.Schema({
    userId:{type:Number,require:true},
    email:{type:String,require:true},
    fullName: String,
    password: {type:String,require:true},
    status: String,
    sponsor: Number,
    pic: String,
    ref: Number,
    coins: Number,
    messages: [{
        message: String,
        date: Number
    }]
});
userSchema.methods.generatHarsh = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(9));
};
userSchema.methods.validPassword =function (password) {
    return bcrypt.compareSync(password,this.password);
};
module.exports = mongoose.model('users', userSchema);