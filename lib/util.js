var redis = require("redis");
var common = require('../common');
var config = require('../config').config;
var memcache = require('memcached');


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

//设置Memcache的验证码
function setMCcaptchaProcess(key, value, callback) {
    mclient.get(key, function (err, answer) {
        if (common.IsNullOrEmpty(answer)) {
            mclient.set(key, value, config.captcha.expiretime * 60, function (err2, ok) {
                callback(value);
            });
        }
        else {
            callback(answer);
        }
    });
};
//获取Memcache的验证码
function getMCcaptchaProcess(key, callback) {
    mclient.get(key, function (err, answer) {
        callback(answer);
    });
};

//加密
function encryptProcess(cryptkey, iv, cleardata) {
    var crypto = require('crypto');
    var encipher = crypto.createCipheriv('aes-256-cbc', cryptkey, iv),
    encoded = encipher.update(cleardata, 'utf8', 'base64');
    encoded += encipher.final('base64');
    return encoded;
};

//解密
function decryptProcess(cryptkey, iv, secretdata) {
    var crypto = require('crypto');
    var decipher = crypto.createDecipheriv('aes-256-cbc', cryptkey, iv),
    decoded = decipher.update(secretdata, 'base64', 'utf8');

    decoded += decipher.final('utf8');
    return decoded;
};

exports.getaccesstoken = accesstokenProcess;
exports.getshorten = shortenProcess;
exports.setMCcaptcha = setMCcaptchaProcess;
exports.getMCcaptcha = getMCcaptchaProcess;
exports.encrypt = encryptProcess;
exports.decrypt = decryptProcess;