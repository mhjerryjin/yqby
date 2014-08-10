var config = require("../config").config;
var io = require('socket.io').listen(config.server.port);
var db = require("./db");

io.sockets.on('connection', function(socket){
  socket.on('init', function(quesid){
    socket.join(quesid);
    getComment(quesid, function(comments){
      socket.emit('comments', comments)
    });
  });
  socket.on('comment', function  (comment) {
    db.addComment(comment.quesid, comment, function(){
      io.sockets.in(comment.quesid).emit('comment', comment);
    });
  });
});