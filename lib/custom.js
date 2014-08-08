var common = require('../common');
var util = require('./util');
var config = require('../config').config;

//发送客服消息
function sendcustommessageProcess(weixinid, content, callback) {
	util.getaccesstoken(function (access_token) {
		var messageObj =
		{
			"touser": weixinid,
			"msgtype": "text",
			"text": {
				"content": content
			}
		};
		var options = {
			method: 'POST',
			uri: config.weixin.api.send_custom + '?access_token=' + access_token,
			body: JSON.stringify(messageObj)
		};
		var request = require('request');
		request(options, function (err, resp, result) {
			if (err) {
				common.log(err);
				callback(0);
			}
			else if (resp.statusCode == 200)
				callback(1);
		});
	});
};

	exports.sendCustomMessage = sendcustommessageProcess;