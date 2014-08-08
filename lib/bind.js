var qs = require("querystring");
var url = require("url");
var redis = require("redis");
var common = require("../common");
var config = require("../config").config;

function bindProcess(res, req) {
    var weixinid = qs.parse(url.parse(req.url).query).u;
    if (common.IsNullOrEmpty(weixinid)) {
        common.WriteHtml(res, req, '您的链接有误，请返回重新操作！');
    }
    else {
        var redisClient = redis.createClient(config.redis.port, config.redis.host);
        redisClient.hget(config.redis.storage.mainkey, weixinid, function (ex, result) {
            if (ex) {
                console.log(ex);
                common.WriteHtml(res, req, '服务器发生错误，请返回重新操作！');
            }
            else {
                var authorizeUri = config.mdapi.appuri.authorize + '?app_key=' + config.mdapi.appkey + '&redirect_uri=' + escape(config.mdapi.callbackuri) + '&state=' + escape(weixinid);
                if (common.IsNullOrEmpty(result)) {
                    var t = new Date().getTime();
                    var expire = (new Date()).setTime(t + 1000 * 60 * 60);

                    res.setHeader("Set-Cookie", ["wxid=" + weixinid + ";path=/;domain=mingdao.com;expires=" + expire]);

                    common.Redirect(res, req, authorizeUri);
                }
                else {
                    var user = JSON.parse(result);
                    authorizeUri += '&is_auto=1';
                    common.WriteHtml(res, req, '<p>您已经绑定明道账户 ' + user.email + ' 请返回“我的明道”公众服务号，转发信息给服务号即可将信息分享到明道</p><p>切换到其他账户<a href=\'' + authorizeUri + '\'>请点击这里</a></p>');
                }
            }
        });
    }
};

function callbackProcess(res, req) {
    var code = qs.parse(url.parse(req.url).query).code;
    var weixinid = qs.parse(url.parse(req.url).query).state;
    if (common.IsNullOrEmpty(code) || common.IsNullOrEmpty(weixinid)) {
        common.WriteHtml(res, req, '您的链接有误，请返回重新操作！');
    }
    else {
        var authorizeUri = config.mdapi.appuri.authorize + '?app_key=' + config.mdapi.appkey + '&redirect_uri=' + escape(config.mdapi.callbackuri) + '&state=' + escape(weixinid);
        getuserinfo(code, authorizeUri, function (err, userObj) {
            if (err)
                common.WriteHtml(res, req, userObj);
            else {
                var redisClient = redis.createClient(config.redis.port, config.redis.host);

                var async = require('async');
                async.parallel([
                    function (next) {
                        if (!common.IsNullOrEmpty(userObj.uid)) {
                            var weixinObj = { "wxid": weixinid };
                            redisClient.hset(config.redis.storage.mainMDkey, userObj.uid, JSON.stringify(weixinObj), function (ex1, result1) { });
                        }
                    },
                    function (next) {
                        redisClient.hset(config.redis.storage.mainkey, weixinid, JSON.stringify(userObj), function (ex, result) {
                            if (ex) {
                                common.Log(ex);
                                common.WriteHtml(res, req, '服务器发生错误，请返回重新操作！');
                            }
                            else {
                                authorizeUri += '&is_auto=1';
                                common.WriteHtml(res, req, '<p>恭喜您，您已经成功绑定明道账户 ' + userObj.email + '<br/>请返回“我的明道”公众服务号，转发信息给服务号即可将信息分享到明道</p><p>切换到其他账户<a href=\'' + authorizeUri + '\'>请点击这里</a></p>');
                            }
                        });
                    } ],
                    function (err) { });
            }
        });
    }
};

//重新绑定，切换明道账户
function rebindProcess(res, req) {
    var weixinid = qs.parse(url.parse(req.url).query).u;
    var token = qs.parse(url.parse(req.url).query).t;
    if (common.IsNullOrEmpty(weixinid) || common.IsNullOrEmpty(token)) {
        common.WriteHtml(res, req, '您的链接有误，请返回重新操作！');
    }
    else {
        var async = require('async');
        async.parallel([
            function (next) {
                logout(token, function (err, resp, result) { });
            },
            function (next) {
                var redisClient = redis.createClient(config.redis.port, config.redis.host);
                redisClient.hdel(config.redis.storage.mainkey, weixinid, function (ex, result) { });
            },
            function (next) {
                var authorizeUri = config.mdapi.appuri.authorize + '?app_key=' + config.mdapi.appkey + '&redirect_uri=' + escape(config.mdapi.callbackuri) + '&state=' + escape(weixinid);
                common.Redirect(res, req, authorizeUri);
            } ],
            function (err) { });
    }
};

function getuserinfo(code, authorizeUri, callback) {
    var request = require('request');

    var accesstokenUri = config.mdapi.appuri.access_token + '?app_key=' + config.mdapi.appkey + '&app_secret=' + config.mdapi.appsecret;
    accesstokenUri += '&grant_type=authorization_code&code=' + code + '&redirect_uri=' + config.mdapi.callbackuri + '&format=json';

    request.get(accesstokenUri, function (err, resp, result) {
        if (err) {
            common.Log(err);
            callback(err, '获取授权出错，请返回重新操作！');
        }
        else if (resp.statusCode == 200) {
            result = JSON.parse(result);
            if (result.access_token) {
                //用户基本信息
                var userdetailUri = config.mdapi.appuri.passportuseretail + '?access_token=' + result.access_token + '&format=json';

                request.get(userdetailUri, function (err2, res2, result2) {
                    if (err2) {
                        common.Log(err2);
                        callback(err2, '获取授权出错，请返回重新操作！');
                    }
                    else {
                        result2 = JSON.parse(result2);
                        var userObj = { uid: result2.user.id, email: result2.user.email, name: result2.user.name, token: result.access_token, refreshtoken: result.refresh_token };
                        callback(null, userObj);
                    }
                });
            }
            else {
                console.log(accesstokenUri);
                authorizeUri += '&is_auto=1';
                callback(true, '<p>获取授权出错</p><p><a href=\'' + authorizeUri + '\'>请点击这里</a>重新绑定</p>');
            }
        }
        else
            callback(true, '获取授权出错，服务器无响应，请返回重新操作！');
    });
};

//查找微信对应的用户
function findUser(res, req, weixinid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    redisClient.hget(config.redis.storage.mainkey, weixinid, function (ex, result) {
        if (ex) {
            common.Log(ex);
            callback(ex, '存储服务器发生错误，请返回重新操作！');
        }
        else {
            console.log(weixinid + ':' + result);
            if (common.IsNullOrEmpty(result))
                callback(true, '用户暂无绑定明道账户，请返回重新操作');
            else {
                var user = JSON.parse(result);
                callback(null, user);
            }
        }
    });
};

function bindProcessByID(userid, weixinid, callback) {
    var request = require('request');
    var tokenuri = config.mdapi.appuri.access_tokenbyid;
    var options = {
        method: 'POST',
        uri: tokenuri,
        timeout: 3000,
        form:
            {
                id: userid,
                token_pwd: config.mdapi.mdprivatekey
            }
    };
    request(options, function (mderr, mdresp, mdresult) {
        if (mderr)
            callback(null);
        else if (mdresp.statusCode == 200) {
            var userObj = common.Replace(mdresult, "access_token", "token");
            userObj = common.Replace(userObj, "refresh_token", "refreshtoken");
            userObj = JSON.parse(userObj);

            var redisClient = redis.createClient(config.redis.port, config.redis.host);

            var async = require('async');
            async.parallel([
                function (next) {
                    if (!common.IsNullOrEmpty(userObj.uid)) {
                        var weixinObj = { "wxid": weixinid };
                        redisClient.hset(config.redis.storage.mainMDkey, userObj.uid, JSON.stringify(weixinObj), function (ex1, result1) { });
                    }
                },
                function (next) {
                    redisClient.hset(config.redis.storage.mainkey, weixinid, JSON.stringify(userObj), function (ex2, result2) {
                        if (ex2) {
                            common.Log(ex2);
                            callback(null);
                        }
                        else
                            callback(userObj);
                    });
                } ],
                function (err) { });
        }
    });
};

//查找用户微信OpenID
function findUserOpenID(userid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    redisClient.hget(config.redis.storage.mainMDkey, userid, function (ex, result) {
        if (ex) {
            common.Log(ex);
            callback(null);
        }
        else {
            if (common.IsNullOrEmpty(result))
                callback(null);
            else {
                var wxObj = JSON.parse(result);
                callback(wxObj);
            }
        }
    });
};

//移除用户绑定信息
function removeUser(res, req, weixinid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    redisClient.hget(config.redis.storage.mainkey, weixinid, function (ex, result) {
        if (common.IsNullOrEmpty(result))
            callback(ex, result);
        else {
            var weixinUser = JSON.parse(result);
            var userid = weixinUser.uid;

            var async = require('async');
            async.parallel([
                function (next) {
                    redisClient.hdel(config.redis.storage.mainMDkey, userid, function (ex1, result1) {
                        next();
                    });
                },
                function (next) {
                    redisClient.hdel(config.redis.storage.mainkey, weixinid, function (ex2, result2) {
                        next();
                    });
                } ],
                function (err) {
                    callback(ex, result);
                });
        }
    });
};

function logout(token, callback) {
    var options = {
        method: 'POST',
        uri: config.mdapi.appuri.logout,
        form: {
            access_token: token,
            format: 'json'
        }
    };
    var request = require('request');
    request(options, callback);
};

exports.bind = bindProcess;
exports.callback = callbackProcess;
exports.find = findUser;
exports.findOpenID = findUserOpenID;
exports.remove = removeUser;
exports.bindbyid = bindProcessByID;