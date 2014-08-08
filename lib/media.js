var qs = require("querystring");
var url = require("url");
var redis = require("redis");
var common = require('../common');
var config = require('../config').config;
var util = require('./util');

//获取下载地址
function getmedia(res, req) {
    var mediaid = qs.parse(url.parse(req.url).query).id;
    if (common.IsNullOrEmpty(mediaid)) {
        common.WriteHtml(res, req, '您的链接有误，下载出错！');
    }
    else {
        util.getaccesstoken(function (access_token) {
            var redirectUri = config.weixin.api.download_media + '?access_token=' + escape(access_token) + '&media_id=' + mediaid;
            common.Redirect(res, req, redirectUri);
        });
    }
};

exports.getmedia = getmedia;