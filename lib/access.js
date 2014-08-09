var qs = require("querystring");
var url = require("url");
var crypto = require("crypto");
var xmlParser = require('xmldom').DOMParser;
var xmlSelect = require('xpath.js');
var async = require('async');
var common = require("../common");
var util = require("./util");
var custom = require("./custom");
var config = require("../config").config;
var defaultMsg = '想要解决什么问题，寻求小伙伴的帮助，您可以直接发送文字、图片、语音等内容寻求帮助！';
var redis = require('redis');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
var uuid = require('node-uuid');
var moment = require('moment');

//处理发送分享流程
function accessProcess(res, req) {
	if (req.method == "GET")
		processAccess(res, req);
	else if (req.method == "POST") {
		var body = '';
		req.on('data', function (data) {
			body += data;
		});
		req.on('end', function () {
			console.dir(body);

			var parser = new xmlParser({
				errorHandler: {
					error: function (msg) {
						common.Log(msg);
						common.Write(res, req, null, false, false);
					}
				}
			});

			var doc = parser.parseFromString(body, 'text/xml');
			var from = xmlSelect(doc, "//FromUserName/text()")[0].data;
			var to = xmlSelect(doc, "//ToUserName/text()")[0].data;
			var msgtype = xmlSelect(doc, "//MsgType/text()")[0].data;

			var message = { "msg": "", "type": 1 };

			switch (msgtype) {
				case 'event':
					var eventType = xmlSelect(doc, "//Event/text()")[0].data;
					var eventKey = "";
					var eventKeyNodes = xmlSelect(doc, "//EventKey");
					if (eventKeyNodes != null && eventKeyNodes.length > 0) {
						if (eventKeyNodes[0].hasOwnProperty('firstChild')) {
							if (eventKeyNodes[0].firstChild.hasOwnProperty('data'))
								eventKey = eventKeyNodes[0].firstChild.data;
						}
					}
					if (eventType == 'subscribe')
						processSubscribe(res, req, from, to);
					else if (eventType == 'unsubscribe')
						processUnsubscribe(res, req, from, to);
					else
						processOtherEvent(res, req, eventKey, from, to)
					break;
				case 'text':
					var msg = "";
					var msgNodes = xmlSelect(doc, "//Content");
					if (msgNodes != null && msgNodes.length > 0) {
						if (msgNodes[0].hasOwnProperty('firstChild')) {
							if (msgNodes[0].firstChild.hasOwnProperty('data'))
								msg = msgNodes[0].firstChild.data;
						}
					}
					if (common.IsNullOrEmpty(msg))
						processMessage(res, req, from, to, defaultMsg);
					else {
						message.msg = msg;
						processQuestion(res, req, from, to, message);
					}
					break;
				case 'image':
					message.type = 2;
					message.msg = '从微信分享图片';
					var picurl = xmlSelect(doc, "//PicUrl/text()")[0].data;
					message.image = picurl;
					processQuestion(res, req, from, to, message);
					break;
				case 'voice':
					message.type = 3;
					var mediaid = xmlSelect(doc, "//MediaId/text()")[0].data;
					var msg = '原始语音下载地址 ';
					var oUri = config.mdapi.mediauri + '?id=' + escape(mediaid);
					util.getshorten(oUri, function (uri) {
						if (common.IsNullOrEmpty(uri))
							msg += oUri;
						else
							msg += uri;

						var voiceNodes = xmlSelect(doc, "//Recognition");
						if (voiceNodes != null && voiceNodes.length > 0) {
							if (voiceNodes[0].hasOwnProperty('firstChild')) {
								if (voiceNodes[0].firstChild.data && !common.IsNullOrEmpty(voiceNodes[0].firstChild.data))
									message.msg = voiceNodes[0].firstChild.data + ' - 从微信语音识别' + '\r\n\r\n' + msg;
								else
									message.msg = msg;
							}
							else
								message.msg = msg;
						}
						else
							message.msg = msg;
						processQuestion(res, req, from, to, message);
					});
					break;
				case 'video':
					message.type = 4;
					var mediaid = xmlSelect(doc, "//MediaId/text()")[0].data;
					var msg = '从微信分享视频文件，下载地址 ';
					var oUri = config.mdapi.mediauri + '?id=' + escape(mediaid);
					util.getshorten(oUri, function (uri) {
						if (common.IsNullOrEmpty(uri))
							msg += oUri;
						else
							msg += uri;
						message.msg = msg;
						processQuestion(res, req, from, to, message);
					});
					break;
				case 'location':
					var msg = "";
					var msgNodes = xmlSelect(doc, "//Label");
					if (msgNodes != null && msgNodes.length > 0) {
						if (msgNodes[0].hasOwnProperty('firstChild')) {
							if (msgNodes[0].firstChild.hasOwnProperty('data'))
								msg = msgNodes[0].firstChild.data;
						}
					}
					if (common.IsNullOrEmpty(msg))
						processMessage(res, req, from, to, defaultMsg);
					else {
						message.msg = '从微信分享我目前所在位置，我在 ' + msg;
						processQuestion(res, req, from, to, message);
					}
					break;
				case 'link':
					message.type = 5;
					var url = xmlSelect(doc, "//Url/text()")[0].data
					message.url = url;
					var titleNodes = xmlSelect(doc, "//Title");
					if (titleNodes != null && titleNodes.length > 0) {
						if (titleNodes[0].hasOwnProperty('firstChild')) {
							if (titleNodes[0].firstChild.hasOwnProperty('data'))
								message.title = titleNodes[0].firstChild.data;
							else
								message.title = url;
						}
						else
							message.title = url;
					}
					else
						message.title = url;
					var desNodes = xmlSelect(doc, "//Description");
					if (desNodes != null && desNodes.length > 0) {
						if (desNodes[0].hasOwnProperty('firstChild')) {
							if (desNodes[0].firstChild.hasOwnProperty('data'))
								message.msg = '从微信分享链接：' + desNodes[0].firstChild.data.toString();
							else
								message.msg = '从微信分享链接：' + message.title;
						}
						else
							message.msg = '从微信分享链接：' + message.title;
					}
					else
						message.msg = '从微信分享链接';
					processQuestion(res, req, from, to, message);
					break;
				default:
					processMessage(res, req, from, to, defaultMsg);
			}
		});
	}
};

function processQuestion(res, req, from, to, message) {

};

//处理关注事件
function processSubscribe(res, req, from, to) {
	processMessage(res, req, from, to, '欢迎关注有求必应官方公众号，' + defaultMsg);
};
//处理取消关注事件
function processUnsubscribe(res, req, from, to) {
	processMessage(res, req, from, to, '');
};

//处理其它指定的事件
function processOtherEvent(res, req, eventKey, from, to) {
	switch (eventKey) {
		// 点击 发布需求
		case config.weixin.menu.eventkey11:
			//状态设为开始输入需求
		  redisClient.set(config.redis.storage.userInputStatusPrefix + from, config.inputstatus.post_task);
			redisClient.lrange(config.redis.storage.taskDesInputPrefix + from, '0', '-1', function(err, list){
				// 获取已经输入的需求描述，如果已经有了则提示
				if(list){
					//TODO: 处理 list
					processMessage(res, req, from, to, '已经输入的描述：'+list+'点击 找人帮忙->发布完成 确认发布，点击 找人帮忙->取消发布 取消此次需求的发布。');
				} else {
					processMessage(res, req, from, to, '请将您的需求描述发送给我们。您可以分多次发送，点击菜单中的 找人帮忙->发布完成 确认发送。');
				}
			});
			break;
		// 发布完成
		case config.weixin.menu.eventkey12:
			redisClient.get(config.redis.storage.userInputStatusPrefix + from, function(err, status){
				processMessage(res, req, from, to, '请输入截止时间：');

// 下面这段放到消息处理里
					// redisClient.del(config.redis.storage.userInputStatusPrefix + from);
					// redisClient.lrange(config.redis.storage.taskDesInputPrefix + from, '0', '-1', function(err, list){
					// 	if(list){
					// 		// 生成一个 id
					// 		var id = uuid.v4();
					// 		//TODO: 处理 list
					// 		var description = list.join('\r\n');
					// 		redisClient.set(config.redis.storage.taskPrefix + id, 'description', description)
					// 	} else {
					// 		processMessage(res, req, from, to, '您还没有发送任何需求。');
					// 	}
					// });
				
			});

			break;
		// 取消发布
		case config.weixin.menu.eventkey13:
			redisClient.del(config.redis.storage.userInputStatusPrefix + from);
			redisClient.ltrim(config.redis.storage.taskDesInputPrefix + from, '0', '0');
			processMessage(res, req, from, to, '已取消需求的发布。');
			break;
		// 我要做的
		case config.weixin.menu.eventkey21:
			redisClient.hmget(config.redis.storage.userPrefix + from, 'taskid', function(err, taskid){
				redisClient.get(config.redis.storage.taskPrefix + taskid, function(err, task){
					processMessage(res, req, from, to, task ? task : '您还未收到需求。');
				})
			});
			break;
		// 个人中心
		case config.weixin.menu.eventkey31:
			processMessage(res, req, from, to, defaultMsg);
			break;
		default:
			processMessage(res, req, from, to, defaultMsg);
	}
	;
};

//处理返回发送消息
function processMessage(res, req, from, to, msg) {
	console.log(msg);
	var timestamp = common.Timestamp();
	var resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[' + msg + ']]></Content></xml>';
	common.Write(res, req, resData, false, true);
};

//处理发送图文消息
function processNewsMessage(res, req, from, to) {
	var timestamp = common.Timestamp();
	var resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[news]]></MsgType><ArticleCount>4</ArticleCount>';
	resData += '<Articles>';

	resData += '<item>';
	resData += '<Title><![CDATA[您的企业为什么需要明道？]]></Title>';
	resData += '<Description><![CDATA[]]></Description>';
	resData += '<PicUrl><![CDATA[https://mmbiz.qlogo.cn/mmbiz/5EHXp3fZu4hLjj4wUy8BsPJZDU3v0D89BN5qxHsaKyA4JGDgiaqVKIqicCMibCQyQdCB29S9Gg4zbcUA0qlK6Dib0Q/0]]></PicUrl>';
	resData += '<Url><![CDATA[http://mp.weixin.qq.com/mp/appmsg/show?__biz=MzA5MTA2MTUxMg==&appmsgid=10000005&itemidx=1&sign=343d148917db0ed816df74b352b44f4b]]></Url>';
	resData += '</item>';

	resData += '<item>';
	resData += '<Title><![CDATA[3分钟进一步了解明道]]></Title>';
	resData += '<Description><![CDATA[]]></Description>';
	resData += '<PicUrl><![CDATA[https://mmbiz.qlogo.cn/mmbiz/5EHXp3fZu4hLjj4wUy8BsPJZDU3v0D897ttI8LDiapMeZoolDiboicPxTCaQAeHt1mcYMGY9VgkmdyObokVwZvSyg/0]]></PicUrl>';
	resData += '<Url><![CDATA[http://mp.weixin.qq.com/mp/appmsg/show?__biz=MzA5MTA2MTUxMg==&appmsgid=10000005&itemidx=2&sign=37acef57e665371195c143f4ec023fcc]]></Url>';
	resData += '</item>';

	resData += '<item>';
	resData += '<Title><![CDATA[如何开启您的明道之旅]]></Title>';
	resData += '<Description><![CDATA[description1]]></Description>';
	resData += '<PicUrl><![CDATA[https://mmbiz.qlogo.cn/mmbiz/5EHXp3fZu4hLjj4wUy8BsPJZDU3v0D897OMGyyuUjNSwvEg0w4g0ibQIb3J4fspMZgyE6PTyGKRjJn4yibVbSgzQ/0]]></PicUrl>';
	resData += '<Url><![CDATA[http://mp.weixin.qq.com/mp/appmsg/show?__biz=MzA5MTA2MTUxMg==&appmsgid=10000005&itemidx=3&sign=e40606f8d1d8afeee67442db62837311]]></Url>';
	resData += '</item>';

	resData += '<item>';
	resData += '<Title><![CDATA[致开发者：加入明道开放平台吧！]]></Title>';
	resData += '<Description><![CDATA[]]></Description>';
	resData += '<PicUrl><![CDATA[https://mmbiz.qlogo.cn/mmbiz/5EHXp3fZu4hLjj4wUy8BsPJZDU3v0D89SLYicpQ2BJTaNjQnYz8iaGJIPoMicWze5k4rGicI1Kp8pTY9AHlIt000NQ/0]]></PicUrl>';
	resData += '<Url><![CDATA[http://mp.weixin.qq.com/mp/appmsg/show?__biz=MzA5MTA2MTUxMg==&appmsgid=10000005&itemidx=4&sign=fd03f34f7e083eecdcad22b8034c7058]]></Url>';
	resData += '</item>';

	resData += '</Articles>';
	resData += '</xml>';
	common.Write(res, req, resData, false, true);
};

//处理验证可访问事件
function processAccess(res, req) {
	var _signature = qs.parse(url.parse(req.url).query).signature;
	var _timestamp = qs.parse(url.parse(req.url).query).timestamp;
	var _nonce = qs.parse(url.parse(req.url).query).nonce;
	var _echostr = qs.parse(url.parse(req.url).query).echostr;

	if (common.IsNullOrEmpty(_signature) || common.IsNullOrEmpty(_timestamp) ||
		common.IsNullOrEmpty(_nonce) || common.IsNullOrEmpty(_echostr)) {
		common.Write(res, req, null, false, false);
	}
	else {
		var arr = new Array(config.weixin.token, _timestamp, _nonce);
		arr.sort();
		var str = arr.join('');
		var sha1 = crypto.createHash('sha1').update(str).digest('hex');

		var logstring = 'weixin:' + _signature + '\tsha1:' + sha1 + '\tpara:' + arr.join();
		common.Log(logstring);

		if (_signature == sha1)
			common.Write(res, req, _echostr, false, true);
		else
			common.Write(res, req, null, false, false);
	}
};

//处理首页
function processHomepage(res, req) {
	var html = '<html><header><title>有求必应 </title></header><body><p>提交您的问题，让小伙伴们来帮您解决！</p>';
	html += '<img src=\"http://down.mingdao.com/md_qrcode.jpg\" />';
	html += '<p>目前支持特性';
	html += '<ul><li>提交问题</li>';
	html += '</ul></p>';
	html += '</body></html>';
	common.WriteHtml(res, req, html);
};

exports.access = accessProcess;
exports.homepage = processHomepage;
