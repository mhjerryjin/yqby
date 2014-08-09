var config = {
	server: {
		port: 3000
	},
	redis: {
		host: '127.0.0.1',
		port: 6379,
		storage: {
			mainUserkey: 'yqby_user',	//	存储用户信息的key，field是用户编号，value同时存储用户发布的需求的编号和被分配到的需求编号，HASH
			allQueskey: 'yqby_ques',	//	所有存储需求池子的key，field是需求编号，value是需求具体内容，HASH
			unAssignedQueskey: 'yqby_ques_unas',	//	尚未被分派的需求池子的key，value是需求的编号与发布作者的JSON，LIST
			assignedQueskey: 'yqby_ques_as',	//	已经被分配的需求池子的key，filed是需求编号，value是被分配的用户编号，HASH
			accesstokenKey: 'yqby_wxat'	//暂存的accessToken，String
		},
		//用户上次操作有效时间
		userlpExpiretime: 5,
		//用户加入的群组时间
		usergroupExpiretime: 480,
		//获取的访问令牌有效期
		accesstokenExpiretime: 60
	},
	inputstatus: {
		default: 0,
		post_task: 1, // 正在分段发送需求
		wait_for_deadline: 2 //点击发布完成，等待输入截止时间
	},
	weixin: {
		token: 'xxoo',
		appkey: 'wx21b41014a26161dd',
		appsecret: '9c3934bd17bfe6d7292c1c056435709d',
		api: {
			access_token: 'https://api.weixin.qq.com/cgi-bin/token',
			create_menu: 'https://api.weixin.qq.com/cgi-bin/menu/create',
			remove_menu: 'https://api.weixin.qq.com/cgi-bin/menu/delete',
			download_media: 'http://file.api.weixin.qq.com/cgi-bin/media/get',
			qrticket: 'https://api.weixin.qq.com/cgi-bin/qrcode/create',
			send_custom: 'https://api.weixin.qq.com/cgi-bin/message/custom/send',
			qrcode: 'https://mp.weixin.qq.com/cgi-bin/showqrcode',
			userinfo: 'https://api.weixin.qq.com/cgi-bin/user/info?lang=zh_CN'
		},
		menu: {
			eventkey11: 'post_task_start',
			eventkey12: 'post_task_end',
			eventkey13: 'post_task_cancel',
			eventkey21: 'my_task',
			eventkey31: 'personal_center'
		}
	},
	filepath: 'd:/weixin/',
	logpath: 'd:/log_weixin.txt'
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