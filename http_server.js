var http_server = function () {

	var _this = this;
	var http = require("http"); //http服务器
	var cluster = require('cluster');
	var url = require("url");
	var numCPUs = require('os').cpus().length;
	var route = require("./router").route;
	var cfg = require("./config");
	var config = cfg.config;
	var handle = cfg.router;
	/*
	 *	启动HTTP服务器 并且运行框架
	 */
	this.start = function () {
		var listen = config.server.port;
		if (cluster.isMaster) {
			for (var i = 0; i < numCPUs; i++) {
				cluster.fork();
			}

			cluster.on('exit', function (worker, code, signal) {
				console.log('error: ' + worker.process.pid + ' died');
			});
		}
		else {
			var server = http.createServer(_this.on).listen(listen, function () {
				console.log("success:在" + listen + "上跑起来了");
			});
			var io = require('socket.io').listen(server);
			var db = require("./lib/db");

			io.sockets.on('connection', function(socket){
			  socket.on('init', function(info){
			    socket.join(info.quesid);
			    db.getComment(info.quesid, function(comments){
			      socket.emit('comments', comments)
			    });
			  });
			  socket.on('comment', function  (comment) {
			    db.addComment(comment.quesid, comment, function(){
			      io.sockets.in(comment.quesid).emit('comment', comment);
			    });
			  });
			});
		}
	};

	this.on = function (req, res) {
		var pathname = url.parse(req.url).pathname;
		route(handle, pathname, res, req);
	};
}

module.exports = http_server;