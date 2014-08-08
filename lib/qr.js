var qs = require("querystring");
var url = require("url");
var common = require('../common');
var util = require('./util');
var account = require('./bind');
var custom = require('./custom');
var config = require('../config').config;
var redis = require("redis");

//二维码获取链接（关注公众号并绑定用户）
function getqrcodeProcess(res, req) {
    var userid = qs.parse(url.parse(req.url).query).id;
    var key = qs.parse(url.parse(req.url).query).k;
    if (common.IsNullOrEmpty(userid) || common.IsNullOrEmpty(key))
        common.WriteHtml(res, req, 'missing parameter');
    else if (userid.length != 36)
        common.WriteHtml(res, req, 'missing parameter');
    else if (key != config.mdapi.qrkey)
        common.WriteHtml(res, req, 'key is wrong');
    else
        qrcodeProcess(res, req, userid, 0);
};

//二维码获取链接（关注公众号并绑定用户，同时发送验证码）
function getqrcodecaptchaProcess(res, req) {
    var userid = qs.parse(url.parse(req.url).query).id;
    var key = qs.parse(url.parse(req.url).query).k;
    if (common.IsNullOrEmpty(userid) || common.IsNullOrEmpty(key))
        common.WriteHtml(res, req, 'missing parameter');
    else if (userid.length != 36)
        common.WriteHtml(res, req, 'missing parameter');
    else if (key != config.mdapi.qrkey)
        common.WriteHtml(res, req, 'key is wrong');
    else
        qrcodeProcess(res, req, userid, config.captcha.basenumber);
};

function qrcodeProcess(res, req, userid, baseNumber) {
    var request = require('request');
    var iduri = config.mdapi.appuri.get_autoid;
    var options = {
        method: 'POST',
        uri: iduri,
        timeout: 4000,
        form:
            {
                uid: userid,
                token_pwd: config.mdapi.mdprivatekey
            }
    };
    request(options, function (mderr, mdresp, mdresult) {
        if (mderr) {
            common.Log(mderr);
            common.WriteHtml(res, req, 'api getautoid is wrong');
        }
        else if (mdresp.statusCode == 200) {
            mdresult = JSON.parse(mdresult);
            util.getaccesstoken(function (access_token) {
                var mdticket = { "expire_seconds": 1800, "action_name": "QR_SCENE", "action_info": { "scene": { "scene_id": mdresult.id}} };
                if (!common.IsNullOrEmpty(baseNumber) && baseNumber != 0) {
                    var uid = parseInt(mdresult.id);
                    uid += baseNumber;
                    mdticket = { "expire_seconds": 1800, "action_name": "QR_SCENE", "action_info": { "scene": { "scene_id": uid}} };
                }
                var options2 = {
                    method: 'POST',
                    uri: config.weixin.api.qrticket + '?access_token=' + access_token,
                    body: JSON.stringify(mdticket)
                };

                request(options2, function (err, resp, result) {
                    if (err)
                        common.WriteHtml(res, req, err);
                    else {
                        result = JSON.parse(result);
                        var qrpicuri = config.weixin.api.qrcode + '?ticket=' + result.ticket;
                        console.log(qrpicuri);

                        var jsonObj = { "pic": qrpicuri };
                        common.Write(res, req, jsonObj, true, true);
                    }
                });
            });
        }
    });
};

function getqrcodecaptchaValueProcess(res, req) {
    var userid = qs.parse(url.parse(req.url).query).id;
    if (common.IsNullOrEmpty(userid) || userid.length != 36)
        common.Write(res, req, { "code": "" }, true, true);
    else {
        util.getMCcaptcha(config.captcha.mcPrefix + userid, function (captchaNumber) {
            if (common.IsNullOrEmpty(captchaNumber))
                common.Write(res, req, { "code": "" }, true, true);
            else {
                var codeJson = { "code": captchaNumber };
                account.findOpenID(userid, function (wxObj) {
                    if (common.IsNullOrEmpty(wxObj))
                        common.Write(res, req, codeJson, true, true);
                    else {
                        var wxopenid = wxObj.wxid;
                        util.getaccesstoken(function (accesstoken) {
                            var request = require('request');
                            var userinfoUri = config.weixin.api.userinfo + '&access_token=' + accesstoken + '&openid=' + wxopenid;
                            request.get(userinfoUri, function (ex, respon, result) {
                                if (ex) {
                                    common.Log(ex);
                                    common.Write(res, req, codeJson, true, true);
                                }
                                else {
                                    var wxuserinfo = JSON.parse(result);
                                    codeJson["user"] = wxuserinfo;
                                    common.Write(res, req, codeJson, true, true);
                                }
                            });
                        });
                    }
                });
            }
        });
    }
};

//二维码获取链接
function getqrcodeProcess2(res, req) {
    util.getaccesstoken(function (access_token) {
        var mdticket = { "expire_seconds": 1800, "action_name": "QR_SCENE", "action_info": { "scene": { "scene_id": "1"}} };
        var options2 = {
            method: 'POST',
            uri: config.weixin.api.qrticket + '?access_token=' + access_token,
            body: JSON.stringify(mdticket)
        };

        var request = require('request');
        request(options2, function (err, resp, result) {
            if (err)
                common.WriteHtml(res, req, err);
            else {
                result = JSON.parse(result);
                var qrpicuri = config.weixin.api.qrcode + '?ticket=' + result.ticket;
                res.writeHead(200, { "Content-Type": "image/jpg" });
                require('https').get(qrpicuri, function (response) {
                    response.on('data', function (chunk) {
                        res.write(chunk);
                    });
                    response.on('end', function () {
                        res.end();
                    });
                });
            }
        });
    });
};

//输出临时登录二维码，并绑定Session和二维码参数
function getSessionQrcodeProcess(res, req) {
    var sessionid = qs.parse(url.parse(req.url).query).sid;
    if (common.IsNullOrEmpty(sessionid))
        common.WriteHtml(res, req, 'missing parameter');
    else {
        var redisClient = redis.createClient(config.redis.port, config.redis.host);
        redisClient.exists(config.signqrcode.qrcodekey, function (ex, reply) {
            if (common.IsNullOrEmpty(reply)) {
                redisClient.set(config.signqrcode.qrcodekey, config.signqrcode.basenumber, function (ex2, reply2) {
                    sessionQrcodeProcess(res, req, sessionid, config.signqrcode.basenumber);
                });
            }
            else {
                redisClient.incr(config.signqrcode.qrcodekey, function (ex2, reply2) {
                    sessionQrcodeProcess(res, req, sessionid, reply2);
                });
            }
        });
    }
};

//输出临时登录二维码，并绑定Session和二维码参数
function sessionQrcodeProcess(res, req, sessionid, qrcodeid) {
    var request = require('request');
    util.getaccesstoken(function (access_token) {
        var redisClient = redis.createClient(config.redis.port, config.redis.host);
        var userSes = { sid: sessionid, sign: 0 };
        var async = require('async');
        async.parallel([
            function (next) {
                redisClient.hset(config.signqrcode.sessionqrcodekey, sessionid, qrcodeid, function (ex1, reply1) {
                    next();
                });
            },
            function (next) {
                redisClient.hset(config.signqrcode.qrcodesessionkey, qrcodeid, JSON.stringify(userSes), function (ex2, reply2) {
                    next();
                });
            } ],
            function (err) {
                var mdticket = { "expire_seconds": config.signqrcode.expiretime, "action_name": "QR_SCENE", "action_info": { "scene": { "scene_id": qrcodeid}} };
                var options = {
                    method: 'POST',
                    uri: config.weixin.api.qrticket + '?access_token=' + access_token,
                    body: JSON.stringify(mdticket)
                };
                request(options, function (err, resp, result) {
                    if (err)
                        common.WriteHtml(res, req, err);
                    else {
                        result = JSON.parse(result);
                        var qrpicuri = config.weixin.api.qrcode + '?ticket=' + result.ticket;

                        var jsonObj = { "pic": qrpicuri };
                        res.writeHead(200, { "Content-Type": "image/jpg" });
                        require('https').get(qrpicuri, function (response) {
                            response.on('data', function (chunk) {
                                res.write(chunk);
                            });
                            response.on('end', function () {
                                res.end();
                            });
                        });
                    }
                });
            });
    });
};

//二维码扫描之后绑定用户信息并且记录，做下一步的确认推送
function bindSessionQrcodeScanedProcess(user, qucodeid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    redisClient.hget(config.signqrcode.qrcodesessionkey, qucodeid, function (ex, reply) {
        if (common.IsNullOrEmpty(reply))
            callback(false);
        else {
            var userSes = JSON.parse(reply);
            userSes.sign = 1;
            userSes.info = user
            redisClient.hset(config.signqrcode.qrcodesessionkey, qucodeid, JSON.stringify(userSes), function (ex1, reply1) {
                callback(true);
            });
        }
    });
};

//二维码扫描之后确定
function bindSessionQrcodeConfirmedProcess(res, req) {
    var qrcodeid = qs.parse(url.parse(req.url).query).qid;
    if (common.IsNullOrEmpty(qrcodeid))
        common.WriteHtml(res, req, 'missing parameter');
    else {
        var redisClient = redis.createClient(config.redis.port, config.redis.host);
        redisClient.hget(config.signqrcode.qrcodesessionkey, qrcodeid, function (ex, reply) {
            if (common.IsNullOrEmpty(reply))
                common.WriteHtml(res, req, '授权失败，肯定是哪里出了问题了 :( ');
            else {
                var user = JSON.parse(reply);
                if (user.sign == 1) {
                    user.sign = 2;
                    var async = require('async');
                    async.parallel([
                        function (next) {
                            custom.sendCustomMessage(user.info.uid, '授权登录成功 :)', function (status) { });
                        },
                        function (next) {
                            redisClient.hset(config.signqrcode.qrcodesessionkey, qrcodeid, JSON.stringify(user), function (ex2, reply2) {
                                common.WriteHtml(res, req, '授权成功，请返回 :)');
                            });
                        } ],
                        function (err) { });
                }
                else
                    common.WriteHtml(res, req, '授权失败，肯定是哪里出了问题了 :( ');
            }
        });
    }
};

//长链接确认扫描
function pollingSessionQrcodeScanedProcess(res, req) {
    var sessionid = qs.parse(url.parse(req.url).query).sid;
    if (common.IsNullOrEmpty(sessionid))
        common.Write(res, req, "{status:0}", false, true);
    else {
        var redisClient = redis.createClient(config.redis.port, config.redis.host);
        redisClient.hget(config.signqrcode.sessionqrcodekey, sessionid, function (ex, qrcodeid) {
            if (!common.IsNullOrEmpty(qrcodeid)) {
                redisClient.hget(config.signqrcode.qrcodesessionkey, qrcodeid, function (ex2, userSes) {
                    if (!common.IsNullOrEmpty(userSes)) {
                        var userObj = JSON.parse(userSes);
                        //已经扫描
                        if (userObj.sign == 1 || userObj.sign == 2) {
                            common.Write(res, req, "{status: 1}", false, true);
                        }
                        else {
                            var times = 1;
                            var inter = setInterval(function () {
                                times++;
                                redisClient.hget(config.signqrcode.sessionqrcodekey, sessionid, function (ex3, qrcodeid2) {
                                    if (!common.IsNullOrEmpty(qrcodeid2)) {
                                        redisClient.hget(config.signqrcode.qrcodesessionkey, qrcodeid2, function (ex4, userSes2) {
                                            if (!common.IsNullOrEmpty(userSes2)) {
                                                var userObj2 = JSON.parse(userSes2);
                                                //已经确认授权登录
                                                if (userObj2.sign == 1 || userObj2.sign == 2) {
                                                    clearInterval(inter);
                                                    common.Write(res, req, "{status: 1}", false, true);
                                                }
                                            }
                                            if (times > config.signqrcode.pollingtimes) {
                                                clearInterval(inter);
                                                common.Write(res, req, "{status: 2}", false, true);
                                            }
                                        });
                                    }

                                    if (times > config.signqrcode.pollingtimes) {
                                        clearInterval(inter);
                                        common.Write(res, req, "{status: 2}", false, true);
                                    }
                                });
                            }, 1000);
                        }
                    }
                    else
                        common.Write(res, req, "{status:0}", false, true);
                });
            }
            else
                common.Write(res, req, "{status:0}", false, true);
        });
    }
};

//长链接确认登录链接
function pollingSessionQrcodeConfirmedProcess(res, req) {
    var sessionid = qs.parse(url.parse(req.url).query).sid;
    if (common.IsNullOrEmpty(sessionid))
        common.Write(res, req, "{status:0}", false, true);
    else {
        var redisClient = redis.createClient(config.redis.port, config.redis.host);
        redisClient.hget(config.signqrcode.sessionqrcodekey, sessionid, function (ex, qrcodeid) {
            if (!common.IsNullOrEmpty(qrcodeid)) {
                redisClient.hget(config.signqrcode.qrcodesessionkey, qrcodeid, function (ex2, userSes) {
                    if (!common.IsNullOrEmpty(userSes)) {
                        var userObj = JSON.parse(userSes);
                        //已经确认授权登录
                        if (userObj.sign == 2) {
                            common.Write(res, req, "{status: 1, ticket:" + userObj.info.token + "}", false, true);
                        }
                        else {
                            var times = 1;
                            var inter = setInterval(function () {
                                times++;
                                redisClient.hget(config.signqrcode.sessionqrcodekey, sessionid, function (ex3, qrcodeid2) {
                                    if (!common.IsNullOrEmpty(qrcodeid2)) {
                                        redisClient.hget(config.signqrcode.qrcodesessionkey, qrcodeid2, function (ex4, userSes2) {
                                            if (!common.IsNullOrEmpty(userSes2)) {
                                                var userObj2 = JSON.parse(userSes2);
                                                //已经确认授权登录
                                                if (userObj2.sign == 2) {
                                                    clearInterval(inter);
                                                    common.Write(res, req, "{status: 1, ticket:" + userObj2.info.token + "}", false, true);
                                                }
                                            }
                                            if (times > config.signqrcode.pollingtimes) {
                                                clearInterval(inter);
                                                common.Write(res, req, "{status: 2}", false, true);
                                            }
                                        });
                                    }

                                    if (times > config.signqrcode.pollingtimes) {
                                        clearInterval(inter);
                                        common.Write(res, req, "{status: 2}", false, true);
                                    }
                                });
                            }, 1000);
                        }
                    }
                    else
                        common.Write(res, req, "{status:0}", false, true);
                });
            }
            else
                common.Write(res, req, "{status:0}", false, true);
        });
    }
};

exports.getqrcode = getqrcodeProcess;
exports.getqrcodecaptcha = getqrcodecaptchaProcess;
exports.getqrcodecaptchavalue = getqrcodecaptchaValueProcess;
exports.getsessionqrcode = getSessionQrcodeProcess;
exports.scansessionqrcode = bindSessionQrcodeScanedProcess;
exports.confirmsessionqrcode = bindSessionQrcodeConfirmedProcess;
exports.pollingsessionscanedqrcode = pollingSessionQrcodeScanedProcess;
exports.pollingsessionconfirmedqrcode = pollingSessionQrcodeConfirmedProcess;