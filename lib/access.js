﻿﻿﻿
var qs = require("querystring");
var url = require("url");
var config = require("../config").config;
var xmlParser = require('xmldom').DOMParser;
var xmlSelect = require('xpath.js');
var async = require('async');
var common = require("../common");
var util = require("./util");
var custom = require("./custom");
var db = require("./db");
var defaultMsg = '欢迎您参与到有求必应的故事中来。在这里，你可以毫无顾忌的写下一个小小要求——推荐午餐、工作支持、上课点到、游戏求带，吃饭陪伴……甚至可以是更隐秘的心事——对忘不了的那个人发一声晚安、为自己的长相打分、解开心中的阴暗面……你的要求会被我们匿名交给一个靠谱小伙伴完成，作为回报，你需要为另外一个陌生人完成他的小任务。现在，点击左下角的“发布任务”吧！';
var uuid = require('node-uuid');

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

			var message = { "msg": "", "type": 1, "from": from };

			switch (msgtype) {
				case 'event':
				{
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
				}
				case 'text':
				{
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
				}
				case 'image':
				{
					message.type = 2;
					message.msg = '从微信分享图片';
					var picurl = xmlSelect(doc, "//PicUrl/text()")[0].data;
					message.image = picurl;
					processQuestion(res, req, from, to, message);
					break;
				}
				case 'voice':
				{
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
				}
				case 'video':
				{
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
				}
				case 'location':
				{
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
				}
				case 'link':
				{
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
				}
				default:
					processMessage(res, req, from, to, defaultMsg);
			}
		});
	}
};

function processQuestion(res, req, from, to, message) {
	switch (message.type) {
		case 1:    /*文本输入的处理*/
		{
			if (message.msg.toLowerCase() == "y") {
				//确认之后再往需求池子增加需求
				db.addQuestion(from, function (state) {
					if (state == 0)
						processMessage(res, req, from, to, '抱歉，请先发布任务！');
					else {
						//收到需求之后需要回复确认
						//找到一个非自己发的需求，循坏所有待解决的需求
						db.getQuestion(from, function (status, ques) {
							if (status == 0) {
								processMessage(res, req, from, to, '您的任务发布成功！');
							}
							else {
								db.getQuestionDetail(ques.qid, function (result) {
									var content = '你的任务已经到了另外一个小伙伴的手中啦，接下来你收到的任务也要认真完成哟~\n\n任务具体如下\n';
									content = content + result.msg + '\n\n';
									content = content + '这是' + ques.name + '发布的任务，希望你可以严肃活泼的完成。可以完成请回复C，不能完成请回复 N 并将更换你的任务';
									//增加待确认未接受任务
									db.addUnassignedQuestion(from, ques, function (state2) {
										processMessage(res, req, from, to, content);
									});
								});
							}
						});
					}
				});
			}
			else if (message.msg.toLowerCase() == "c") {
				db.getUnassignedQuestion(from, function (state, ques) {
					if (state == 0) {
						processMessage(res, req, from, to, '你没有收到任务噢，点击“发布任务”发布一个新任务吧。');
					}
					else {
						db.getQuestionDetail(ques.qid, function (result) {
							db.getUser(from, function (state2, userDetail) {
								var quesDes = common.ShorternString(result.msg, 10);
								var notiCon = '通知：您发布的"' + quesDes + '"任务已经被' + userDetail.name + '确认可以完成';
								console.log(notiCon);

								custom.sendCustomMessage(ques.user, notiCon, function () {
									db.assignedQuestion(from, ques.qid, function (status) {
										processMessage(res, req, from, to, '该任务已经分派给到您，请您及时完成');
									});
								});
							});
						});
					}
				});
			}
			else {
				//往用户待确认任务里面发布，需要用户确认
				message.id = uuid.v4();
				db.addUnconfirmedQuestion(from, message, function (state) {
					if (state == 0)
						processMessage(res, req, from, to, '抱歉，您尚有未完成的任务，请再完成之后再发布新的任务！');
					else {
						processMessage(res, req, from, to, '有求必应已经收到您发布的任务，请回复 Y 进行确认发布');
					}

				});
			}
			break;
		}
		default:
			processMessage(res, req, from, to, '暂时只支持文本任务 其他模块消息类型码农正在努力开发中。。。');
	}
};

//处理关注事件
function processSubscribe(res, req, from, to) {
	db.addUser(from, function (status) {
		processMessage(res, req, from, to, defaultMsg);
	});
};
//处理取消关注事件
function processUnsubscribe(res, req, from, to) {
	//db.removeUser(from, function (status) {
	processMessage(res, req, from, to, '感谢您订阅有求必应官方公众号！');
	//});
};

//处理其它指定的事件
function processOtherEvent(res, req, eventKey, from, to) {
	switch (eventKey) {
		// 点击 发布需求
		case config.weixin.menu.eventkey11:
			db.getUserAssignedQuestionDetail(from, function (status, data) {
				if (status == 0)
					processMessage(res, req, from, to, '你现在可以向我们发送各种各样的任务内容，然后回复 Y 确认。');
				else
					processMessage(res, req, from, to, '在有未完成任务的时候不能再发布任务。');
			});
			break;
		// 需求详情
		case config.weixin.menu.eventkey21:
			db.getUserAssignedQuestionDetail(from, function (status, data) {
				if (status == 0)
					processMessage(res, req, from, to, '您尚未有未完成的任务，请您先发布任务！');
				else
					processMessage(res, req, from, to, '您收到的任务详情如下\n\n' + data.msg + '\n\n' + '这是' + data.name + '发布的任务');
			});
			break;
		// 我有疑问
		case config.weixin.menu.eventkey22:
			processCommentLink(res, req, from, to);
			break;
		// 搞定啦
		case config.weixin.menu.eventkey23:
			processFinished(res, req, from, to);
			break;
		// 个人中心
		case config.weixin.menu.eventkey31:
			processMessage(res, req, from, to, defaultMsg);
			break;
		default:
		//processMessage(res, req, from, to, defaultMsg);
	}
};

// 处理 我有疑问
function processCommentLink(res, req, from, to) {
	db.getUserAssignedQuestionDetail(from, function (status, ques) {
		if (status == 1) {
			var quesid = ques.id;
			if (common.IsNullOrEmpty(quesid)) {
				processMessage(res, req, from, to, '您尚未有未完成的任务，请您先发布任务！');
			}
			//给接收人发消息
			db.getUser(from, function (status, user) {
				if (status == 0) {
					processMessage(res, req, from, to, '未能获取到您的个人信息。');
				}
				var link = 'http://yqby.mingdao.net/comment?' + qs.stringify({
					quesid: quesid,
					userid: from,
					name: user.name,
					avatar: user.avatar
				});
				var timestamp = common.Timestamp();
				var resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[news]]></MsgType><ArticleCount>1</ArticleCount>';
				resData += '<Articles>';

				resData += '<item>';
				resData += '<Title><![CDATA[点击进入任务讨论]]></Title>';
				resData += '<Description><![CDATA[' + common.ShorternString(ques.msg, 50) + ']]></Description>';
				resData += '<PicUrl><![CDATA[]]></PicUrl>';
				resData += '<Url><![CDATA[' + link + ']]></Url>';
				resData += '</item>';

				resData += '</Articles>';
				resData += '</xml>';

				var quesFrom = ques.from;

				db.getUser(quesFrom, function (status, quesFromUser) {
					var link = 'http://yqby.mingdao.net/comment?' + qs.stringify({
						quesid: quesid,
						userid: quesFrom,
						name: quesFromUser.name,
						avatar: quesFromUser.avatar
					});

					var timestamp = common.Timestamp();

					custom.sendcustommessageNewsProcess(from, [
						{
							"title": user.name + ' 对您的需求有一些疑惑',
							"description": '点此打开讨论页面',
							"url": link
						}
					], function (status2) {

						common.Write(res, req, resData, false, true);

					});
				});

			});
		}
		else
			processMessage(res, req, from, to, '您尚未有未完成的任务，请您先发布任务！');
	});

};

// 搞定啦 完成任务
function processFinished(res, req, from, to) {
	db.getUserAssignedQuestionDetail(from, function (status, data) {
		if (status == 0)
			processMessage(res, req, from, to, '您尚未有未完成的任务，请您先发布任务！');
		else {
			db.finishedQuestion(from, data.id, function (state) {

				db.getUser(from, function (state, userDetail) {
					var quesDes = common.ShorternString(data.msg, 10);
					var notiCon = '您发布的"' + quesDes + '"任务已经被' + userDetail.name + '完成';

					custom.sendCustomMessage(data.from, notiCon, function () {
						processMessage(res, req, from, to, '恭喜您，您的任务已经完成');
					});
				});
			});
		}
	});
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