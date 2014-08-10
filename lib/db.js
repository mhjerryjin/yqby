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
	util.getuserdetail(userid, function (userdetail) {
		var userInfo = {
			name: userdetail.nickname, //微信昵称
			avatar: userdetail.headimgurl, //头像
			ques: [],	//我发布的需求ID集合
			finished: [],	//当前已经完成的需求ID集合
			assigned: ''	//当前分派到的需求编号
		};
		redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userInfo), function (err, reply) {
			callback(1);
		});
	});
};
/*取消关注*/
var removeUser = exports.removeUser = function (userid, callback) {
	redisClient.hdel(config.redis.storage.mainUserkey, userid, function (err, reply) {
		callback(1);
	});
};
/*获取用户详情信息*/
var getUser = exports.getUser = function (userid, callback) {
	redisClient.hget(config.redis.storage.mainUserkey, userid, function (er, userInfo) {
		if (common.IsNullOrEmpty(userInfo)) {
			util.getuserdetail(userid, function (userdetail) {
				console.dir(userdetail);
				var userDetail = {
					name: userdetail.nickname, //微信昵称
					name: userdetail.headimgurl, //微信昵称
					ques: [],	//我发布的需求ID集合
					finished: [],	//当前已经完成的需求ID集合
					assigned: ''	//当前分派到的需求编号
				};
				redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userDetail), function (err, reply) {
					callback(1, userDetail);
				});
			});
		}
		else {
			callback(1, JSON.parse(userInfo));
		}
	});
};

/*发布需求，并且判断目前用户是否有未完成任务，如果没有则暂存，还需要进一步用户确认是否发布*/
var addUnconfirmedQuestion = exports.addUnconfirmedQuestion = function (userid, question, callback) {
	//首先判断用户是否有未完成的需求
	getUser(userid, function (status, userDetail) {
		if (common.IsNullOrEmpty(userDetail.assigned)) {
			redisClient.hset(config.redis.storage.unConfirmedQueskey, userid, JSON.stringify(question), function (err, reply) {
				callback(1);
			});
		}
		else
			callback(0);	//有未完成的任务
	});
};

/*从用户待确认发布的需求里面发布用户的需求*/
var addQuestion = exports.addQuestion = function (userid, callback) {
	//获取用户详情
	getUser(userid, function (er, userDetail) {
		//获取用户已经确认发布的任务
		redisClient.hget(config.redis.storage.unConfirmedQueskey, userid, function (err, reply) {
			if (common.IsNullOrEmpty(reply))
				callback(0);
			else {
				var question = JSON.parse(reply);
				//加入需求发布时间
				question.time = common.Timestamp();
				question.name = userDetail.name;

				var id = question.id;
				//总需求池增加需求
				redisClient.hset(config.redis.storage.allQueskey, id, JSON.stringify(question), function (err1, reply1) {
					//增加未分配的需求池
					var userInfo = {
						qid: id,
						user: userid,
						name: userDetail.name
					};
					redisClient.rpush(config.redis.storage.unAssignedQueskey, JSON.stringify(userInfo), function (err2, reply2) {
						//增加用户与自己发布需求的关联关系
						userDetail.ques.push(id);

						redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userDetail), function (err3, reply3) {
							callback(1);
						});
					});
				});
			}
		});
	});
};

//递归不断从队首获取需求分配给到发布需求的用户，跳过用户自己发布的需求，循环到队尾为止跳出
var getQuestion = exports.getQuestion = function (userid, callback) {
	redisClient.llen(config.redis.storage.unAssignedQueskey, function (err, number) {
		if (common.IsNullOrEmpty(number) || number == 0) {
			callback(0);
		}
		else {
			console.log(number);
			getFirstQuestion(userid, number, callback);	//递归函数调用
		}
	});
};
var getFirstQuestion = function (userid, number, callback) {
	redisClient.lpop(config.redis.storage.unAssignedQueskey, function (err, reply) {
		number--;

		console.dir(number.toString() + ":" + userid);
		console.dir(reply);

		var ques = JSON.parse(reply);
		if (ques.user != userid)
			callback(1, ques);
		else {
			//最后一个如果还是自己发布的需求 则直接返回
			redisClient.rpush(config.redis.storage.unAssignedQueskey, reply, function (err2, reply2) {
				if (number == 0)
					callback(0);
				else
					getFirstQuestion(userid, number, callback);
			});
		}
	});
};

/*为用户增加待确认的任务分配，需要用户回复*/
var addUnassignedQuestion = exports.addUnassignedQuestion = function (userid, ques, callback) {
	redisClient.hset(config.redis.storage.unAssignedConQueskey, userid, JSON.stringify(ques), function (err, reply) {
		callback(1);
	});
};
/*获取用户待确认的任务分配*/
var getUnassignedQuestion = exports.getUnassignedQuestion = function (userid, callback) {
	redisClient.hget(config.redis.storage.unAssignedConQueskey, userid, function (err, reply) {
		if (common.IsNullOrEmpty(reply))
			callback(0);
		else
			callback(1, JSON.parse(reply));
	});
};

/*设置任务被分派的属性*/
var assignedQuestion = exports.assignedQuestion = function (userid, qid, callback) {
	//获取用户详情
	getUser(userid, function (status, userDetail) {
		//增加已被分配的需求池子
		redisClient.hset(config.redis.storage.assignedQueskey, qid, userid, function (err, reply) {
			//增加用户与被分配需求的关联关系
			userDetail.assigned = qid;

			redisClient.hset(config.redis.storage.mainUserkey, userid, JSON.stringify(userDetail), function (err1, reply1) {
				callback(1);
			});
		});
	});
};

/*根据需求编号获取需求详情信息*/
var getQuestionDetail = exports.getQuestionDetail = function (quesid, callback) {
	redisClient.hget(config.redis.storage.allQueskey, quesid, function (err, reply) {
		callback(JSON.parse(reply));
	});
};

//获取用户分派到的任务详情
var getUserAssignedQuestionDetail = exports.getUserAssignedQuestionDetail = function (userid, callback) {
	getUser(userid, function (status, userDetail) {
		if (common.IsNullOrEmpty(userDetail.assigned)) {
			callback(0);
		}
		else {
			getQuestionDetail(userDetail.assigned, function (ques) {
				callback(1, ques);
			});
		}
	});
};

//获取讨论
var getComment = function (quesid, index, size, callback) {
	if (typeof index === 'function') {
		callback = index;
		index = 0;
	}
	index = index ? index : 0;
	size = size ? size : 20;

	start = -((index + 1) * size) - 1;
	end = -(index * size ) - 1;

	redisClient.lrange(config.redis.storage.commentPrefix + quesid, start, end, function (err, comments) {
		callback(comments);
	})
}

// 插入讨论
var addComment = function (quesid, comment, callback) {
	if (typeof comment !== 'string')
		comment = JSON.stringfiy(comment);
	redisClient.rpush(config.redis.storage.commentPrefix + quesid, comment, function (err) {
		if (!err) callback(comment);
	});
}
