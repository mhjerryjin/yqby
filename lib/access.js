var qs = require("querystring");
var url = require("url");
var crypto = require("crypto");
var xmlParser = require('xmldom').DOMParser;
var xmlSelect = require('xpath');
var async = require('async');
var common = require("../common");
var rpc = require("./rpc");
var qr = require("./qr");
var util = require("./util");
var custom = require("./custom");
var config = require("../config").config;

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
			common.Log(body);

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
					if (eventType == 'subscribe') {
						var userid = common.Replace(eventKey, "qrscene_", "");
						processSubscribe(res, req, from, to, userid);
					}
					else if (eventType.toLowerCase() == 'scan') {
						console.log(body);
						var userid = common.Replace(eventKey, "qrscene_", "");
						processSubscribe(res, req, from, to, userid);
					}
					else if (eventType == 'unsubscribe')
						processUnsubscribe(res, req, from, to);
					else
						processOtherEvent(res, req, eventKey, from, to);
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
						processMessage(res, req, from, to, '分享失败，未能获取您的输入信息，请您输入内容再进行分享！');
					else {
						message.msg = msg;
						processFeed(res, req, from, to, message);
					}
					break;
				case 'image':
					message.type = 2;
					message.msg = '从微信分享图片';
					var picurl = xmlSelect(doc, "//PicUrl/text()")[0].data;
					message.image = picurl;
					processFeed(res, req, from, to, message);
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
						processFeed(res, req, from, to, message);
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
						processFeed(res, req, from, to, message);
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
						processMessage(res, req, from, to, '分享失败，未能获取您的位置信息，请您开启定位服务！');
					else {
						message.msg = '从微信分享我目前所在位置，我在 ' + msg;
						processFeed(res, req, from, to, message);
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
					processFeed(res, req, from, to, message);
					break;
				default:
					processMessage(res, req, from, to, null);
			}
			;
		});
	}
};

//处理文本消息
function processFeed(res, req, from, to, message) {
	account.find(res, req, from, function (ex, user) {
		if (ex)
			processMessage(res, req, from, to, null);
		else {
			var options = {
				method: 'POST',
				uri: config.mdapi.appuri.create_feed,
				form: {
					access_token: user.token,
					g_id: '',
					s_type: '0',
					format: 'json'
				}
			};
			var isFile = false;
			var isLink = false;
			switch (message.type) {
				case 1: //文本消息
					options.form.p_msg = message.msg;
					options.form.p_type = 0;
					break;
				case 2: //图片
					isFile = true;
					break;
				case 3: //语音
					break;
				case 4: //视频
					break;
				case 5: //链接
					isLink = true;
					options.form.p_msg = message.msg;
					options.form.p_type = 1;
					options.form.l_title = message.title;
					options.form.l_uri = message.url;
					break;
			}

			if (isFile) {
				feed.fileprocesscallback(user.uid, message.image, function (status) {
					if (status == 1)
						processMessage(res, req, from, to, '您是否需要对刚刚发送的图片加入说明文字？\r\n如果需要请直接回复说明文字即可，如果直接发布图片请回复 N');
					else
						processMessage(res, req, from, to, '分享到明道出错，请重试！');
				});
			}
			else if (isLink)
				processRequest(res, req, options, from, to);
			else {
				feed.getlastprocesscallback(user.uid, function (feedObj) {
					if (common.IsNullOrEmpty(feedObj)) {
						//存储文本内容，并且发送群组选择信息
						feed.feedtextprocesscallback(user.uid, message.msg, function (status) {
							processGroupmessage(res, req, user.token, user.uid, from, to, message.type);
						});
					}
					else {
						if (feedObj.txt) {
							if (common.IsNullOrEmpty(message.msg))
								message.msg = "0";
							//群组选择
							group.getuserchoicedgroupinfo(message.msg, user.token, user.uid, function (groupObj) {
								var stype = 0;
								if (groupObj.my == 1)
									stype = 3;
								else {
									if (!common.IsNullOrEmpty(groupObj.groups) && groupObj.all == 1)
										stype = 2;
									else if (!common.IsNullOrEmpty(groupObj.groups))
										stype = 1;
								}

								if (feedObj.file) {
									//上传图片和文本
									var fields = { access_token: user.token,
										g_id: groupObj.groups,
										s_type: stype,
										f_type: 'picture',
										format: 'json',
										p_msg: escape(feedObj.txt)
									};

									async.parallel([
											function (next) {
												var files = { p_img: feedObj.file };
												rpc.postLocalfile(config.mdapi.appuri.create_feed_file, fields, files, function (err, result) {
													if (err) {
														common.Log(from + ' 分享图片失败 ' + message.image + ' ' + err.toString() + ' ' + result);
													}
												});
											},
											function (next) {
												feed.removelastprocesscallback(user.uid, function (result) {
												});
											},
											function (next) {
												processMessage(res, req, from, to, '成功分享到明道！');
											} ],
										function (err) {
										});
								}
								else {
									options.form.g_id = groupObj.groups;
									options.form.s_type = stype;
									options.form.p_msg = escape(feedObj.txt);
									async.parallel([
											function (next) {
												processRequest(res, req, options, from, to);
											},
											function (next) {
												feed.removelastprocesscallback(user.uid, function (result) {
												});
											},
											function (next) {
												processMessage(res, req, from, to, '成功分享到明道！');
											} ],
										function (err) {
										});
								}
							});
						}
						else if (feedObj.file) {
							if (message.msg == "n" || message.msg == "N") {
								message.msg = '从微信分享图片';
							}

							feed.feedtextprocesscallback(user.uid, message.msg, function (status) {
								processGroupmessage(res, req, user.token, user.uid, from, to, message.type);
							});
						}
					}
				});
			}
		}
	});
};

//处理发送动态
function processRequest(res, req, options, from, to) {
	var request = require('request');
	request(options, function (err, resp, result) {
		if (err)
			processMessage(res, req, from, to, '分享到明道出错，请重试！');
		else if (resp.statusCode == 200) {
			if (result.indexOf('error_code') >= 0) {
				if (result.indexOf('1010') >= 0)
					processMessage(res, req, from, to, '分享到明道出错，您的绑定账号的授权已经过期，请<a href=\'http://weixin.mingdao.com/bind?u=' + escape(from) + '\'>点击这里</a>重新绑定明道账户');
				else
					processMessage(res, req, from, to, '分享到明道出错，您的账号已经被关闭或者被举报离职！');
			}
			else
				processMessage(res, req, from, to, '成功分享到明道！');
		}
	});
};

//处理关注事件
function processSubscribe(res, req, from, to, qrcodeid) {
	var timestamp = common.Timestamp();
	var resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[想将微信的消息或文章分享到明道?只需<a href=\'http://weixin.mingdao.com/bind?u=' + escape(from) + '\'>绑定明道账户</a>\n\n还没有明道账户?<a href=\'http://www.mingdao.com/m/register.htm\'>进入这里注册明道账户</a>]]></Content></xml>';
	account.find(res, req, from, function (ex, user) {
		if (ex) {
			if (common.IsNullOrEmpty(qrcodeid))
				common.Write(res, req, resData, false, true);
			else {
				if (common.Validateint(qrcodeid)) {
					var uid = parseInt(qrcodeid);
					if (qrcodeid >= config.signqrcode.basenumber) {
						//授权网页登录，提醒绑定账户
						resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[请您<a href=\'http://weixin.mingdao.com/bind?u=' + escape(from) + '\'>点击这里</a>先绑定明道账户，绑完账户之后请重新扫描二维码授权登录\n\n还没有明道账户?<a href=\'http://www.mingdao.com/m/register.htm\'>进入这里注册明道账户</a>]]></Content></xml>';
						common.Write(res, req, resData, false, true);
					}
					else {
						//绑定用户并且发送验证码
						if (uid > config.captcha.basenumber)
							uid = uid - config.captcha.basenumber;

						account.bindbyid(uid, from, function (userObj) {
							bindingProcessing(res, req, from, to, qrcodeid, timestamp, userObj, true);
						});
					}
				}
				else
					common.Write(res, req, resData, false, true);
			}
		}
		else {
			//二维码登录
			if (qrcodeid >= config.signqrcode.basenumber) {
				qr.scansessionqrcode(user, qrcodeid, function () {
					resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[请您<a href=\'http://weixin.mingdao.com/code/confirm?qid=' + escape(qrcodeid) + '\'>点击这里</a>确认授权' + common.PartOfReplace(user.email, "*", 2, 8) + ' 登录明道网页版]]></Content></xml>';
					common.Write(res, req, resData, false, true);
				});
			}
			else
				bindingProcessing(res, req, from, to, qrcodeid, timestamp, user, false);
		}
	});
};

//绑定账户_发送验证码
function bindingProcessing(res, req, from, to, userid, timestamp, user, isBinding) {
	var authorizeUri = config.mdapi.appuri.authorize + '?app_key=' + config.mdapi.appkey + '&redirect_uri=' + escape(config.mdapi.callbackuri) + '&state=' + escape(from);
	authorizeUri += '&is_auto=1';
	if (common.IsNullOrEmpty(user))
		resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[想将微信的消息或文章分享到明道?只需<a href=\'http://weixin.mingdao.com/bind?u=' + escape(from) + '\'>绑定明道账户</a>\n\n还没有明道账户?<a href=\'http://www.mingdao.com/m/register.htm\'>进入这里注册明道账户</a>]]></Content></xml>';
	else
		resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[您已经绑定明道账户 ' + common.PartOfReplace(user.email, "*", 2, 8) + '\n\n请直接发送信息给服务号即可将信息分享到明道，切换到其他账户<a href=\'' + authorizeUri + '\'>请点击这里</a>]]></Content></xml>';

	if (common.IsNullOrEmpty(userid) || common.IsNullOrEmpty(user))
		common.Write(res, req, resData, false, true);
	else {

		if (common.Validateint(userid)) {
			var uid = parseInt(userid);
			//发送验证码
			if (uid > config.captcha.basenumber) {
				var numberStr = common.GetRandom(6);
				util.setMCcaptcha(config.captcha.mcPrefix + user.uid, numberStr, function (captchaNumber) {
					if (isBinding)
						resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[您已经绑定明道账户 ' + common.PartOfReplace(user.email, "*", 2, 8) + '\n\n您的验证码是:' + captchaNumber + '，此验证码有效期为' + config.captcha.expiretime + '分钟]]></Content></xml>';
					else
						resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[欢迎您使用明道，您的验证码是:' + captchaNumber + '，此验证码有效期为' + config.captcha.expiretime + '分钟]]></Content></xml>';

					common.Write(res, req, resData, false, true);
				});
			}
			else
				common.Write(res, req, resData, false, true);
		}
		else
			common.Write(res, req, resData, false, true);
	}
};

//处理取消关注事件
function processUnsubscribe(res, req, from, to) {
	account.remove(res, req, from, function (ex, result) {
		processMessage(res, req, from, to, '成功取消关注！');
	});
};

//处理其它指定的事件
function processOtherEvent(res, req, eventKey, from, to) {
	var timestamp = common.Timestamp();
	var resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[想将微信的消息或文章分享到明道?只需<a href=\'http://weixin.mingdao.com/bind?u=' + escape(from) + '\'>绑定明道账户</a>\n\n还没有明道账户?<a href=\'http://www.mingdao.com/m/register.htm\'>进入这里注册明道账户</a>]]></Content></xml>';
	switch (eventKey) {
		case config.weixin.menu.eventkey11:
			processMessage(res, req, from, to, '请您先绑定明道账户，绑定完成之后即可直接发送信息给服务号，我们会将您发送的内容分享到您绑定的明道账户内。\n\n目前我们支持微信的语音、图片、视频、位置、链接、文本信息分享到明道，并且支持选择群组进行分享');
			break;
		case config.weixin.menu.eventkey12:
			processMessage(res, req, from, to, '明道客户端下载方式\n\niPhone版本:http://mdu.pw/1tyGQW4 \n\n安卓版本:http://mdu.pw/F6qf5CR'); //\n\niPad版本:http://mdu.pw/v7mxEAh
			break;
		case config.weixin.menu.eventkey13:
			processMessage(res, req, from, to, '请联系我们\n\n1）客服电话 400-021-6464\n\n2）企业QQ 4000216464\n\n3）发送邮件到 feedback@mingdao.com\n\n4）关注官方微博<a href="http://weibo.com/mingdaowb">明道企业社会化协作</a>');
			break;
		case config.weixin.menu.eventkey21:
			processSubscribe(res, req, from, to, null);
			break;
		case config.weixin.menu.eventkey31:
			//明道(mingdao.com)是为中国企业开发的社会化协作平台,企业2.0产品,核心解决的是企业内部沟通,知识分享和协作的问题。提供免费模式,高级模式和企业私有部署模式。请登陆www.mingdao.com 注册并使用明道。
			processNewsMessage(res, req, from, to);
			break;
		default:
			processMessage(res, req, from, to, null);
	}
	;
};

//处理返回发送消息
function processMessage(res, req, from, to, msg) {
	var timestamp = common.Timestamp();
	var resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[想将微信的消息或文章分享到明道?只需<a href=\'http://weixin.mingdao.com/bind?u=' + escape(from) + '\'>绑定明道账户</a>\n\n还没有明道账户?<a href=\'http://www.mingdao.com/m/register.htm\'>进入这里注册明道账户</a>]]></Content></xml>';
	if (!common.IsNullOrEmpty(msg))
		resData = '<xml><ToUserName><![CDATA[' + from + ']]></ToUserName><FromUserName><![CDATA[' + to + ']]></FromUserName><CreateTime>' + timestamp + '</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[' + msg + ']]></Content></xml>';

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
	var html = '<html><header><title>"我的明道" 微信公众服务号 - 明道 mingdao.com,企业社会化协作平台,企业2.0产品</title></header><body><p>想将微信看到的好东西分享到明道，哈哈哈，简单了<br/>您只需要在微信关注“我的明道”公众服务号或者扫描下面的二维码进行关注，在绑定明道账户之后，通过向服务号转发消息即可，我们的服务号会自动帮你分享到明道！<br/>操作过程中发现问题请吐槽，欢迎at明道开发小组或者发邮件至：feedback#mingdao.com</p>';
	html += '<img src=\"http://down.mingdao.com/md_qrcode.jpg\" />';
	html += '<p>目前支持特性';
	html += '<ul><li>支持明道账户绑定</li>';
	html += '<li>将微信文本消息分享到明道</li>';
	html += '<li>将微信的图片分享到明道，且支持图文组合分享到明道</li>';
	html += '<li>支持语音识别分享到明道</li>';
	html += '<li>将微信视频分享到明道</li>';
	html += '<li>支持选择群组进行分享</li>';
	html += '</ul></p>';
	html += '</body></html>';
	common.WriteHtml(res, req, html);
};

//处理推送
function pushProcess(res, req) {
	var _userid = qs.parse(url.parse(req.url).query).id;
	var _message = qs.parse(url.parse(req.url).query).m;

	if (!common.IsNullOrEmpty(_userid) && !common.IsNullOrEmpty(_message)) {
		custom.sendCustomMessage(_userid, _message, function (status) {
			common.Write(res, req, null, false, true);
		});
	}
	els
		common.Write(res, req, null, false, false);
};

exports.access = accessProcess;
exports.homepage = processHomepage;
exports.push = pushProcess;