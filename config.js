var config = {
	server: {
		port: 80
	},
	redis: {
		host: '127.0.0.1',
		port: 6379,
		storage: {
			mainUserkey: 'yqby_user',   //  存储用户信息的key，field是用户编号，value同时存储用户发布的需求的编号和被分配到的需求编号，HASH
			allQueskey: 'yqby_ques',    //  所有存储需求池子的key，field是需求编号，value是需求具体内容，HASH
			unAssignedQueskey: 'yqby_ques_unas',    //  尚未被分派的需求池子的key，value是需求的编号与发布作者的JSON，LIST
			assignedQueskey: 'yqby_ques_as',    //  已经被分配的需求池子的key，filed是需求编号，value是被分配的用户编号，HASH
			unConfirmedQueskey: 'yqby_ques_uncon',  //  待用户回复确认才发布的任务集合的key，field是用户编号，value是需求具体内容，HASH
			unAssignedConQueskey: 'yqby_ques_unascon',    //  待用户回复确认才接受的任务集合的key，field是用户编号，value是需求编号和用户编号，HASH
			accesstokenKey: 'yqby_wxat' //暂存的accessToken，String
		},
		//用户上次操作有效时间
		userlpExpiretime: 5,
		//用户加入的群组时间
		usergroupExpiretime: 480,
		//获取的访问令牌有效期
		accesstokenExpiretime: 60
	},
	weixin: {
		token: 'xxoo',
		appkey: 'wx21b41014a26161dd',
		appsecret: '9c3934bd17bfe6d7292c1c056435709d',
		api: {
			access_token: 'https://api.weixin.qq.com/cgi-bin/token',
			user_detail: 'https://api.weixin.qq.com/cgi-bin/user/info?lang=zh_CN',
			create_menu: 'https://api.weixin.qq.com/cgi-bin/menu/create',
			remove_menu: 'https://api.weixin.qq.com/cgi-bin/menu/delete',
			download_media: 'http://file.api.weixin.qq.com/cgi-bin/media/get',
			qrticket: 'https://api.weixin.qq.com/cgi-bin/qrcode/create',
			send_custom: 'https://api.weixin.qq.com/cgi-bin/message/custom/send',
			qrcode: 'https://mp.weixin.qq.com/cgi-bin/showqrcode',
			userinfo: 'https://api.weixin.qq.com/cgi-bin/user/info?lang=zh_CN'
		},
		menu: {
			eventkey11: 'task_start',
			eventkey21: 'task_detail',
			eventkey22: 'task_ques',
			eventkey23: 'task_end',
			eventkey31: 'my_task'
		}
	},
	filepath: '/usr/local/yqby/log/',
	logpath: '/usr/local/yqby/log/log_weixin.txt'
};
exports.config = config;

var accessHandler = require("./lib/access");
var menuHandler = require("./lib/menu");
var handle = {};
handle["/"] = accessHandler.homepage;
handle["/access"] = accessHandler.access;
handle["/menu/create"] = menuHandler.createmenu;
handle["/menu/remove"] = menuHandler.removemenu;
exports.router = handle;