var redis = require("redis");
var rpc = require("./rpc");
var common = require("../common");
var config = require("../config").config;

//下载微信图片返回结果
function fileprocesscallback(userid, uri, callback) {
    var filename = config.filepath + common.Replace(userid, '-', '') + common.Timestamp() + '.jpg'

    var http = require('http');
    var fs = require('fs');
    var file = fs.createWriteStream(filename);

    http.get(uri, function (response) {
        response.pipe(file, { end: true });

        response.on('end', function () {
            file.end();

            var redisClient = redis.createClient(config.redis.port, config.redis.host);
            var key = config.redis.storage.userlpPrefix + userid;
            var feedObj = { file: filename };
            //即使之前已经有值，也需要覆盖，重新发图相当于是一个新的会话周期
            redisClient.setex(key, config.redis.userlpExpiretime * 60, JSON.stringify(feedObj), function (err, result) {
                callback(1);
            });
        });

        response.on('error', function () {
            file.end();
            callback(0);
        });
    });
};

//上传已经下载微信图片并返回结果
function postfileprocesscallback(weixinid, userid, fields, filename, callback) {
    var files = { p_img: filename };
    rpc.postLocalfile(config.mdapi.appuri.create_feed_file, fields, files, function (err, result) {
        if (err) {
            common.Log(weixinid + ' ' + userid + ' 分享图片失败 ' + filename + ' ' + err.toString() + ' ' + result);
            callback(0);
        }
        else
            callback(1);
    });
};

//记录动态的文本内容并返回结果
function feedtextprocesscallback(userid, msg, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    var key = config.redis.storage.userlpPrefix + userid;
    getlastprocesscallback(userid, function (result) {
        var feedObj = {};
        if (!common.IsNullOrEmpty(result)) {
            feedObj = result;
        }
        feedObj['txt'] = msg;
        redisClient.setex(key, config.redis.userlpExpiretime * 60, JSON.stringify(feedObj), function (err, result2) {
            callback(1);
        });
    });
};

//获取上次流程当中的内容
function getlastprocesscallback(userid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    var key = config.redis.storage.userlpPrefix + userid;

    redisClient.get(key, function (err, result) {
        if (!common.IsNullOrEmpty(result)) {
            var feedObj = JSON.parse(result);
            callback(feedObj);
        }
        else
            callback(null);
    });
};

//删除上次流程当中的内容
function removelastprocesscallback(userid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    var key = config.redis.storage.userlpPrefix + userid;

    redisClient.del(key, function (err, result) {
        callback(result);
    });
};

exports.fileprocesscallback = fileprocesscallback;
exports.feedtextprocesscallback = feedtextprocesscallback;
exports.postfileprocesscallback = postfileprocesscallback;
exports.getlastprocesscallback = getlastprocesscallback;
exports.removelastprocesscallback = removelastprocesscallback;