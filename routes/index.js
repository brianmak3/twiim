var Nexmo = require('nexmo');
var nexmo = new Nexmo({
    apiKey: '4e823dde',
    apiSecret: 'jnY8dF3JAThmkgn5'
});

var nodemailer = require('nodemailer'),
 http = require('http').Server(),
 client = require('socket.io').listen(8083).sockets,
 User = require('./model/users'),
 Data = require('./model/data'),
 Faqs = require('./model/faqs'),
 Challenge = require('./model/challenges'),
 multer = require('multer'),
 fs = require('fs'),
 storage =   multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
        var extArray = file.mimetype.split("/");
        var extension = extArray[1];
        callback(null, file.fieldname + '_'+Date.now()+'.'+extension);
    }

}),
 upload = multer({ storage : storage}).single('twiim'),
 interval;
if(!interval){ 
  interval = setInterval(function () {
    Challenge.find({type: 'available'}, {type: 1, endDate: 1, endTime: 1, id: 1}, function(err, res){
          if(err)
            throw err;
          else{
            var challs = res.map(a=>a.id)
            res.forEach(function(challenge, index){
               if(Date.parse(challenge.endDate+' '+challenge.endTime) > Date.now()){
                  challs.splice(index, 1);
               }
            });
            
            Challenge.update({'id': {$in: challs}}, {$set: {type: 'review'}}, {multi: true}, function(err, res){
               if(err)
                 throw err;
            })
          }
    })
  }, 300000)
  }
module.exports = function (app) {
    app.get('/', function (req, res) {
        res.send('Error 404: Page not found.');
    });
    app.post('/imageUpload', function(req, res) {
        upload(req, res, function (err) {
            if (err)
                console.log(err);
            else
                var pic = 'uploads/' + req.file.filename;
            var userId = req.body.id;
                res.status(201).json(pic);
                User.findOne({'userId': userId}, function (err, user) {
                    if (err)
                        throw err;
                    else {
                        var imageurl = user.pic;
                        var imagefolder = imageurl.split('/');
                        if (imagefolder[0] == 'uploads') {
                            fs.unlink('public/' + imageurl, function () {
                            });
                        }
                    }
                });
                User.updateOne({'userId': userId}, {$set: {'pic': pic}}, function (err) {
                    if (err)
                        throw err;
                });
        })
    });
    client.on('connection', function (socket) {
        socket.on('appData',function(data){
            var module = data.module;
          switch(module) {
            case 'fetchComments':
                 Faqs.findOne({_id: data.id},{comments: 1, _id:0}, function(err, user){
                  if(err)
                    throw err;
                  else 
                    console.log(user.comments);
                  socketResponse(socket, {
                    module: 'availablecomments',
                    comments: user.comments
                  }) 
                 })
            break;
            //transferring coins
            case 'removeFaq':
            Faqs.remove({_id: data.faqId}, function(err, res){
              if(err)
                throw err;
              else
                console.log(res); 
            })
            break;
            case 'newData':
                if(data.commQuiz == 'quiz'){
                   var newFaq = new Faqs();
                   newFaq._id = data.time;
                   newFaq.quiz = data.info;
                   newFaq.by = data.by;
                   newFaq.save(function(err){
                    if(err)
                      throw err;
                              })
                }else{
                   var newComment = {
                    comment: data.info,
                      _id: data.time,
                      by: data.by
                   }
                  Faqs.updateOne({_id: data.currentFaq}, {$push: {comments: newComment}}, function(err, res){
                    if(err)
                       throw err
                     else console.log(res);
                  })

                }
            socketResponse(socket, data, true);
            break;
            case 'getFaqs':
                Faqs.find({}, {_id: 1, quiz: 1}, function(err, faqs){
                  if(err)
                    throw err;
                  else
                   if(faqs.length > 0){
                     socketResponse(socket, {module: 'foundFaqs', faqs: faqs}, null);
                   }
                } ).sort({$natural: -1});
              break;
            case 'transfer':
               User.findOne({userId: data.myId}, {coins: 1, _id: 0}, function(err, user){
                    if(err)
                       throw err;
                     var message;
                      if(user.coins < (data.charge + data.amnt))
                        message = 'Sorry transaction failed.You have insufficient coins to transfer to '+data.friendId.userId;
                      else{
                        var reduction = user.coins - (data.charge + data.amnt);
                        message = 'You have transferred ' +data.amnt+ ' coins to '+ data.friendId.fullName+' account ID '+data.friendId.userId+'. Transaction costs '+data.charge+'. Your new account balance is  '+reduction;
                        var trans = [
                            {sender: data.myId, amnt: -(data.charge + data.amnt)},
                            {sender:  0, amnt: data.charge},
                            {sender: data.friendId.userId, amnt: data.amnt}
                        ];
                        for (i = 0 ; i < trans.length -1 ; i++) {
                          console.log(trans[i]);
                          User.updateOne({userId: trans[i].sender}, {$inc: {coins: trans[i].amnt}}, function(err, res){
                            if (err)
                              throw err;
                            else
                              console.log(res);
                          })
                        }
                      }
                      //send message to friend too
                      socketResponse(socket, {
                          module: 'TransferResponse',
                          message: message}
                          );
               });
             break;
            case 'checkFriend':
            if(data.friendId !== 0){
                   User.findOne({userId: data.friendId}, {pic: 1, fullName: 1, _id: 0, userId: 1}, function(err,user){
                    if(err)
                      throw err;
                    else{
                        socketResponse(socket, {
                          module: 'MoreResponse',
                          submodule: 'friendFound',
                          user: user
                      }, null);
                    }
                   });
                }
                      break;
              case 'updateProfile':

                  if(data.info[3]){
                      User.updateOne({userId: data.info[0]},
                          {$set: {
                                  fullName: data.info[1],
                                  email: data.info[2],
                                  sponsor: data.info[3]
                              }},
                          function (err) {
                              if(err)
                                  throw err;
                          });
                  }else{
                      User.updateOne({userId: data.info[0]},
                          {$set: {
                                  fullName: data.info[1],
                                  email: data.info[2]
                              }},
                          function (err) {
                              if(err)
                                  throw err;
                          });
                  }

                  socketResponse(socket, {
                      module: 'profileUpdated',
                     info: data.info
                  }, null);

                  break;
              case 'placeCoins':
                  var options = data.data;
                  var options1 = [];
                  var totalOnCoins = 0;
                  options.map(function(option){
                      if(!option.putCoins){
                          option.putCoins = 0;
                      }
                      if(!option.possibleWin){
                          option.possibleWin = 0;
                      }
                     options1.push({
                         value: option.value,
                         coinsPlaced: option.putCoins,
                         possibleWin: option.possibleWin
                     });
                      totalOnCoins +=option.putCoins;
                  });
                  var better = {
                      userId: data.userId,
                      options: options1
                  };
                  var message;
                  User.findOne({'userId': data.userId}, {coins: 1}, function (err, res) {
                      if(err)
                          throw err;
                      else if(res){
                          if(res.coins < totalOnCoins){
                              message = 'You don\'t have enough coins';
                              socketResponse(socket, {
                                  module: 'user_optionsCoins',
                                  submodule:'placedBet',
                                  message: message,
                                  coins: totalOnCoins
                              }, null);
                          }else {
                              Challenge.updateOne({'id': data.challId}, {$push: {betters: better}}, function (err) {
                                  if (err)
                                      throw err;
                                  else {
                                      User.updateOne({'userId': data.userId}, {$inc: {coins: -totalOnCoins}}, function(err){
                                          if(err)
                                              throw err;
                                          else{
                                              message = 'Your bet has been placed';

                                          }
                                          socketResponse(socket, {
                                              module: 'user_optionsCoins',
                                              submodule:'placedBet',
                                              message: message,
                                              coins: totalOnCoins
                                          }, null);
                                      });
                                  }
                              });
                              Challenge.updateOne({'id': data.challId}, {$inc: {optionsTotal: totalOnCoins}},function (err) {
                                  if(err)
                                      throw err;
                              });
                          }
                      }
                  });
                  break;
              case 'calculateRates':
                  Challenge.findOne({'id': data.challId},{Options:1, optionsTotal: 1}, function (err, res) {
                      if(err)
                          throw err;
                      else{
                          for(m = 0; m < res.Options.length; m++){
                                var opCoins = parseInt(data.coins[m].putCoins) + parseInt(res.Options[m].coins);
                              var rate = parseFloat((res.optionsTotal + data.totaltPutCoins)/opCoins);
                                    rate = rate+'';
                              var rate1 = rate.split('.');
                                  if(rate1[1]) {
                                      rate = parseFloat(rate1[0] + '.' + rate1[1].substr(0, 1));
                                  }
                              data.coins[m].rate = rate;
                              var coins =  parseFloat(data.coins[m].rate * data.coins[m].putCoins).toFixed(2);
                              data.coins[m].admin = coins.split('.')[1];
                              data.coins[m].possibleWin = Math.floor(coins);
                          }
                          socketResponse(socket, {
                              module: 'user_optionsCoins',
                              submodule:'calCoins',
                              coins: data.coins
                          }, null);

                      }
                  });

                      break;
              case 'user_optionsCoins':
                  User.findOne({'userId': data.userId}, {coins: 1}, function (err, res) {
                     if(err)
                         throw err;
                     else{
                         Challenge.findOne({'id': data.challengeId},{Options:1, optionsTotal: 1}, function (err, options) {
                             if(err)
                                 throw err;
                             else{
                                 socketResponse(socket, {
                                     module: 'user_optionsCoins',
                                     submodule: 'user_optionsCoins',
                                     info: [res.coins, options.Options, options.optionsTotal]
                                 }, null);
                             }
                         })
                     }
                  });
                  break;
              case 'login':
                  var info
                     User.findOne({'userId': data.data[0]}, function (err, res) {
                         if(err)
                             throw err;
                          if(!res){
                            info =  'phoneError';
                         }else if(!res.validPassword(data.data[1])){
                             info =  'passError';
                         }else{
                             info = res;
                         }
                         socketResponse(socket, {
                             module: 'errorLogin',
                             info: info
                         }, null);
                     });

                  break;
              case 'passRetrieve':
                  User.findOne({'userId': data.info.num}, function (err, res) {
                      if(err)
                          throw err;
                      else{
                          var found;
                          var code;
                          if(res){
                              found = 'numFound';
                              code = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                              nexmo.message.sendSms('8801779090677', '254'+data.info.num,
                                  'Your verification code is '+code+'. ',
                                  function(err, responseData) {
                                      if(err)
                                          console.log(err);
                                    }
                              );

                          }else{
                              found = 'noNum';
                          }
                          socketResponse(socket, {
                              module: 'errorLogin',
                              info: found,
                              code: code
                          }, null);
                      }
                  });
                  break;
              case 'updatePaswword':
                  var usX = new User();
                  User.updateOne({'userId': data.userId}, {$set: {
                          password: usX.generatHarsh(data.pass)
                      }}, function (err, res) {
                      if(err)
                          throw err;
                      else{
                          socketResponse(socket, {
                              module: 'errorLogin',
                              info: 'reset'
                          }, null)
                      }
                  });
                  break;
              case 'signup':
              User.findOne({'userId': data.data[1]},function (err, user) {
                  if(err)
                     throw err;
                   if(user){
                    socketResponse(socket, {
                      module: 'phoneExists'
                    }, null)
                  }else{
                      var newUser = {}
                      var datam = data.data;
                      newUser.userId = datam[1];
                      newUser.email = datam[2];
                      newUser.fullName = datam[0];
                      newUser.password = datam[4];
                      newUser.sponsor = datam[3];
                      newUser.coins = 0;
                      newUser.random = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                      nexmo.message.sendSms('8801779090677', '254'+newUser.userId, 'Your verification code is '+newUser.random+'. ',
                           function(err, responseData){
                           if (err) {
                               console.log(err);
                           }else{
                               socketResponse(socket, {
                                   module: 'successSignup',
                                   info: newUser
                               }, null)
                            }
                         }
                         );

                  }
              });
              break;
              case 'registerUser':
                  var newUser = new User();
                  var user = data.user;
                  newUser.userId = user.userId;
                  newUser.email = user.email;
                  newUser.fullName = user.fullName;
                  newUser.password = newUser.generatHarsh(user.password);
                  newUser.sponsor = user.sponsor;
                  newUser.pic = 'images/avatar.jpeg';
                  newUser.coins = 0;
                  newUser.random = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                  User.count({}, function(err, number){
                      if(err)
                          throw err;
                      else {
                          newUser.ref = number;
                          newUser.save(function(err) {
                              if (err)
                                  throw err;
                              else{
                                  socketResponse(socket, {
                                      module: 'errorLogin',
                                      info: newUser
                                  }, null)
                              }
                          })
                      }
                  });
                  break;
              case 'newChallenge':
                 var datam = data.data;
                  var newChallenge = new Challenge();
                  newChallenge.name = datam[0];
                  newChallenge.startDate = datam[5];
                  newChallenge.startTime =  datam[4];
                  newChallenge.endDate = datam[1];
                  newChallenge.endTime = datam[2];
                  newChallenge.question = datam[3];
                  newChallenge.Options = data.options;
                  newChallenge.id =  Date.now();
                  newChallenge.type =  'available';
                  newChallenge.optionsTotal = 0;
                  newChallenge.save(function(err){
                      if(err)
                          throw err;
                      else
                          socketResponse(socket, {
                              module: 'newChallengeAdded',
                              challenge: newChallenge
                          }, true);
                  });
                break;
              case 'challengesFetch':
                  Challenge.find({}, {betters: 0}, function (err, challenges) {
                      if(err)
                          throw err;
                      else if(challenges.length > 0){
                          socketResponse(socket, {
                              module: 'foundChallenges',
                              challenges: challenges
                          })
                      }
                  }).sort({$natural: -1});
                  break;
              case 'deleteChallenge':
                  Challenge.remove({'id': data.id}, function (err) {
                     if(err)
                         throw err;
                     else
                         socketResponse(socket, {
                             module: 'delChallenge',
                             challengeId: data.id
                         }, true);
                  });
                  break;
              case 'updateChallenge':
                  var datam = data.data;
                 Challenge.updateOne({'id': data.challengeId}, {$set: {
                     'name': datam[0],
                     'startDate': datam[5],
                     'startTime':  datam[4],
                     'endDate': datam[1],
                     'endTime': datam[2],
                     'question': datam[3],
                     'Options': data.options,
                     }}, function(err){
                     if(err)
                         throw err;
                     else{
                        Challenge.findOne({'id': data.challengeId}, function(err, res){
                            if(err)
                                 throw err;
                            socketResponse(socket, {
                                module: 'challUpdate',
                                challenge: res
                            }, true);
                        })
                     }
                 });
                  break;
                  case 'mycoinsPut':
                  Challenge.aggregate([
                     {
                      $match: {id: data.challengeId}
                     },
                     {
                      $project: {"betters": 1, _id:0}
                     },
                     {
                      $unwind: "$betters"
                     },
                     {
                      $match: {"betters.userId": data.userId}
                     },
                      {
                      $unwind: "$betters.options"
                     },
                     {
                      $project: {"betters.options": 1, _id:0}
                     },
                     {
                      $group: {
                        _id: "$betters.options.value",
                        possibleWin:  {$sum:"$betters.options.possibleWin"},
                        coinsPlaced: {$sum: "$betters.options.coinsPlaced"}
                       }
                     },
                     {$project:{
                        _id:1,
                        coinsPlaced: 1,
                        possibleWin: 1

                     }}
                     ]).exec(function(err, res){
                      if(err)
                        throw err;
                      else if(res.length > 0){
                          socketResponse(socket, {
                            module: 'checkCoins',
                            data: res
                          }, null);
                      }
                     })
                  break;
                  case 'updateEarns':
                   switch(data.ans){
                      case 'cancelChallenge':
                         Challenge.aggregate([
                              {
                                $match: {id: data.challengeId}
                               },
                               {
                                $project: {"betters": 1, _id:0, optionsTotal: 1, question: 1}
                               },
                               {
                                $unwind: "$betters"
                               },
                               {
                                $unwind: "$betters.options"
                               }, 
                               {
                                $group: {
                                  _id: {name: "$betters.userId", optionsTotal: "$optionsTotal", question: "$question" },
                                  coinsPlaced: {$sum: "$betters.options.coinsPlaced"}
                                      }
                               }

                          ]).exec(function(err, res){
                            if(err)
                              throw err; 
                            else{
                              Challenge.updateOne({id: data.challengeId}, {$set: {
                                    type: 'reviewed',
                                    betters: [],
                                    optionsTotal: 0
                                }}, function(err){
                                  if(err)
                                    throw err;
                                  else{
                                    updateCoins(res, 'cancelled');
                                  }
                                })

                              }
                          })
                      break;
                      
                      default:
                      Challenge.aggregate([
                               {
                                $match: {id: data.challengeId}
                               },
                               {
                                $project: {"betters": 1, _id:0, optionsTotal: 1, question: 1}
                               },
                               {
                                $unwind: "$betters"
                               },
                               {
                                $unwind: "$betters.options"
                               },
                               {
                                $match: {"betters.options.value": data.ans}
                               }, 
                               {
                                $group: {
                                  _id: {name: "$betters.userId", optionsTotal: "$optionsTotal", question: "$question"  },
                                        coinsPlaced: {$sum: "$betters.options.coinsPlaced"},
                                        coinsWon: {$sum: "$betters.options.possibleWin" } 
                                      }
                               }

                          ]).exec(function(err, res){
                            if(err)
                              throw err; 
                            else{
                              Challenge.updateOne({id: data.challengeId}, {$set: {
                                    type: 'reviewed',
                                    betters: [],
                                    optionsTotal: 0
                                }}, function(err){
                                  if(err)
                                    throw err;
                                  else{
                                    updateCoins(res, data.ans);
                                  }
                                })
                              }
                          })
                      break;
                   }
                  break;
          }
        });
    })
};
function updateCoins(res, status){
   var totalCoins = res[0]._id.optionsTotal;
   var message;
   res.map(function(user){
     if(status == 'cancelled'){
        message = "The Challenge '"+user._id.question+"' was cancelled. You got a refund of "+user.coinsPlaced+ (user.coinsPlaced == 1 ? " coin.": " coins.")
        totalCoins -= user.coinsPlaced;
     }else if(user.coinsWon > 0){
        message = "The Challenge '"+user._id.question+"' was completed. Congratulations you won "+user.coinsWon+ (user.coinsWon == 1 ? " coin": " coins")+ " for the correct answer: "+status;
        totalCoins -= user.coinsWon;
     }else{
       message = "The Challenge '"+user._id.question+"' was completed. The correct answer was "+status;
     }
     User.updateOne({userId: user._id.name}, 
      {$inc: {coins: user.coinsWon}},
      function(err, resp){
        if(err)
          throw err 
          User.updateOne({userId: user._id.name}, 
          {$push: {messages: {
            message: message,
            date: Date.now()
          }} }, function(err, resp){
            if(err)
              throw err 
          
          })
      })
   })
    User.updateOne({userId: 0}, 
      {$inc: {coins: totalCoins}}
    ,function(err, res){
      if(err)
        throw err;
      else 
        console.log(res);
    });

}
function socketResponse(socket, data, third) {
    socket.emit('serverData', data);
    if(third){
        socket.broadcast.emit('serverData', data);
    }
}
