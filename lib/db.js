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

/*发布需求，并且判断目前用户是否有未完成任务，如果没有则暂存，还需要进一步用户确认是否发布*/
var addUnconfirmedQuestion = exports.addUnconfirmedQuestion = function (userid, question, callback) {
	//首先判断用户是否有未完成的需求
	redisClient.hget(config.redis.storage.mainUserkey, userid, function (err, result) {
		if (common.IsNullOrEmpty(result)) {
			redisClient.hset(config.redis.storage.unConfirmedQueskey, userid, JSON.stringify(question), function (err1, reply) {
				callback(1);
			});
		}
		else {
			var userInfo = JSON.parse(result);

			if (common.IsNullOrEmpty(userInfo.assigned)) {
				redisClient.hset(config.redis.storage.unConfirmedQueskey, userid, JSON.stringify(question), function (err1, reply) {
					callback(1);
				});
			}
			else
				callback(0);	//有未完成的任务
		}
	});
};

/*从用户待确认发布的需求里面发布用户的需求*/
var addQuestion = exports.addQuestion = function (userid, callback) {
	//获取用户已经确认发布的任务
	redisClient.hget(config.redis.storage.unConfirmedQueskey, userid, function (err, reply) {
		if (common.IsNullOrEmpty(reply))
			callback(0);
		else {
			var question = JSON.parse(reply);
			//加入需求发布时间
			question.time = common.Timestamp();
			var id = question.id;
			//总需求池增加需求
			redisClient.hset(config.redis.storage.allQueskey, id, JSON.stringify(question), function (err1, reply1) {
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
								ques: [],	//我发布的需求ID集合
								finished: [],	//当前已经完成的需求ID集合
								assigned: ''	//当前分派到的需求ID集合
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
		}
	});
};

/*用户从系统自动随机分派一个需求*/
var getAQuestion = exports.getAQuestion = function (userid, callback) {
	redisClient.lpop(config.redis.storage.unAssignedQueskey, function (err, reply) {
		console.dir(userid);
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
								finished: [],
								assigned: ques.qid
							};

							redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userQues), function (err5, reply5) {
								callback(1, ques);
							});
						}
						else {
							var userQues = JSON.parse(reply4);
							userQues.assigned = ques.qid;

							redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userQues), function (err5, reply5) {
								callback(1, ques);
							});
						}
					});
				});
			}
		}
	});
};

/*根据需求编号获取需求详情信息*/
var getQuestionDetail = exports.getQuestionDetail = function (quesid, callback) {
	redisClient.hget(config.redis.storage.allQueskey, quesid, function (err, reply) {
		callback(JSON.parse(reply));
	});
};

//获取用户分派到的任务详情
var getUserAssignedQuestion = exports.getUserAssignedQuestion = function (userid, callback) {
	redisClient.hget(config.redis.storage.mainUserkey, userid, function (err, reply) {
		if (common.IsNullOrEmpty(reply)) {
			callback(0);
		}
		else {
			var userQues = JSON.parse(reply);
			if (common.IsNullOrEmpty(userQues.assigned)) {
				callback(0);
			}
			else {
				getQuestionDetail(userQues.assigned, function (ques) {
					callback(1, ques);
				});
			}
		}
	});
};