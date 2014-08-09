/**
 * Created by Jerry on 14-8-9.
 * 用于redis 的操作
 * 包括 用户记录 需求池管理
 */
var util = require("./util");
var common = require("../common");
var config = require("../config").config;
var redis = require('redis');
var redisClient = redis.createClient(config.redis.port, config.redis.host);

/*新增关注，加入用户信息*/
var addUser = exports.addUser = function (userid, callback) {
	redisClient.hset(config.redis.storage.mainUserkey, userid, '', function (err, reply) {
		callback(1);
	});
};
/*取消关注*/
var removeUser = exports.removeUser = function (userid, callback) {
	redisClient.hdel(config.redis.storage.mainUserkey, userid, function (err, reply) {
		callback(1);
	});
};

/*用户发布需求*/
var addQuestion = exports.addQuestion = function (userid, question, callback) {
	var id = question.id;
	//总需求池增加需求
	redisClient.hset(config.redis.storage.allQueskey, id, JSON.stringify(question), function (err, reply) {
		//增加未分配的需求池
		var userInfo = {
			qid: id,
			user: userid
		};
		redisClient.rpush(config.redis.storage.unAssignedQueskey, JSON.stringify(userInfo), function (err2, reply2) {
			//增加用户与自己发布需求的关联关系
			redisClient.hget(config.redis.storage.mainUserkey, userid, function (err3, reply3) {
				if (common.IsNullOrEmpty(reply3)) {
					var userQues = {
						ques: [],
						assigned: []
					};
					userQues.ques.push(id);

					redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userQues), function (err4, reply4) {
						callback(1);
					});
				}
				else {
					var userQues = JSON.parse(reply3);
					userQues.ques.push(id);

					redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userQues), function (err4, reply4) {
						callback(1);
					});
				}
			});
		});
	});
};

/*用户从系统自动随机分派一个需求*/
var getAQuestion = exports.getAQuestion = function (userid, callback) {
	redisClient.lpop(config.redis.storage.unAssignedQueskey, function (err, reply) {
		console.dir(err);
		console.dir(reply);
		if (common.IsNullOrEmpty(reply))
			callback(0);
		else {
			var ques = JSON.parse(reply);
			//如果这条队尾的需求是自己的则不做处理，说明是最后一条需求，需要重新回到列表
			if (ques.user == userid) {
				redisClient.rpush(config.redis.storage.unAssignedQueskey, reply, function (err2, reply2) {
					callback(0);
				});
			}
			else	//这条需求是别人的，则进行分派给自己
			{
				//增加已被分配的需求池子
				redisClient.hset(config.redis.storage.assignedQueskey, ques.qid, userid, function (err3, reply3) {
					//增加用户与被分配需求的关联关系
					redisClient.hget(config.redis.storage.mainUserkey, userid, function (err4, reply4) {
						if (common.IsNullOrEmpty(reply4)) {
							var userQues = {
								ques: [],
								assigned: []
							};
							userQues.assigned.push(ques.qid);

							redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userQues), function (err5, reply5) {
								callback(1, ques.qid);
							});
						}
						else {
							var userQues = JSON.parse(reply4);
							userQues.assigned.push(ques.qid);

							redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userQues), function (err5, reply5) {
								callback(1, ques.qid);
							});
						}
					});
				});
			}
		}
	});
};

/*获取需求详情信息*/
var getQuestionDetail = exports.getQuestionDetail = function (quesid, callback) {
	redisClient.hget(config.redis.storage.allQueskey, quesid, function (err, reply) {
		callback(JSON.parse(reply));
	});
};