var redis = require("redis");
var common = require('../common');
var config = require('../config').config;

//获取操作accesstoken
function accesstokenProcess(callback) {
	var redisClient = redis.createClient(config.redis.port, config.redis.host);
	redisClient.get(config.redis.storage.accesstokenKey, function (err, token) {
		if (common.IsNullOrEmpty(token)) {
			var request = require('request');
			var accesstokenUri = config.weixin.api.access_token + '?grant_type=client_credential&appid=' + config.weixin.appkey + '&secret=' + config.weixin.appsecret;
			request.get(accesstokenUri, function (ex, res, result) {
				if (ex) {
					common.Log(ex);
					callback(null);
				}
				else {
					result = JSON.parse(result);
					var access_token = result.access_token;

					redisClient.setex(config.redis.storage.accesstokenKey, config.redis.accesstokenExpiretime * 60, access_token, function (err, result) {
						callback(access_token);
					});
				}
			});
		}
		else
			callback(token);
	});
};
//获取用户基本信息
function userdetailProcess(userid, callback) {
	accesstokenProcess(function (accessToken) {
		var request = require('request');
		var userdetailUri = config.weixin.api.user_detail + 'access_token=' + accessToken + '&openid=' + userid;
		request.get(userdetailUri, function (ex, res, result) {
			if (ex) {
				common.Log(ex);
				callback(null);
			}
			else {
				result = JSON.parse(result);
				callback(result);
			}
		});
	});
};

//获取短链
function shortenProcess(uri, callback) {
	var request = require('request');
	var shortenuri = config.mdapi.shortenuri.replace(/\{0\}/, uri);
	request.get({ url: shortenuri, timeout: 2000 }, function (ex, res, result) {
		if (ex) {
			common.Log(ex);
			callback(null);
		}
		else {
			var shortenObj = JSON.parse(result);
			console.log('shorturi ---- ' + shortenObj.shorturl);
			callback(shortenObj.shorturl);
		}
	});
};

exports.getaccesstoken = accesstokenProcess;
exports.getuserdetail = userdetailProcess;
exports.getshorten = shortenProcess;