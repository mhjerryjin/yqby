var common = require('../common');
var util = require('./util');
var config = require('../config').config;

//菜单创建
function createmenuProcess(res, req) {
    util.getaccesstoken(function (access_token) {
        var menu =
            {
                "button": [
                {
                    "name": "帮 助",
                    "sub_button":
                    [{
                        "type": "click",
                        "name": "如何分享信息?",
                        "key": config.weixin.menu.eventkey11
                    },
                    {
                        'type': "click",
                        "name": "下载APP",
                        "key": config.weixin.menu.eventkey12
                    },
                    {
                        'type': "click",
                        "name": "联系我们",
                        "key": config.weixin.menu.eventkey13
                    }]
                },
                {
                    "type": "click",
                    "name": "绑定账户",
                    "key": config.weixin.menu.eventkey21
                },
                {
                    "type": "click",
                    "name": "关于明道",
                    "key": config.weixin.menu.eventkey31
                }]
            };
        var options = {
            method: 'POST',
            uri: config.weixin.api.create_menu + '?access_token=' + access_token,
            body: JSON.stringify(menu)
        };
        var request = require('request');
        request(options, function (err, resp, result) {
            if (err)
                common.WriteHtml(res, req, '创建菜单错误 ' + err);
            else if (resp.statusCode == 200)
                common.WriteHtml(res, req, result);
        });
    });
};

//菜单删除
function removemenuProcess(res, req) {
    util.getaccesstoken(function (access_token) {
        var removemenuUri = config.weixin.api.remove_menu + '?access_token=' + access_token;

        var request = require('request');
        request.get(removemenuUri, function (err, resp, result) {
            if (err)
                common.WriteHtml(res, req, '删除菜单错误 ' + err);
            else if (resp.statusCode == 200)
                common.WriteHtml(res, req, result);
        });
    });
};

exports.createmenu = createmenuProcess;
exports.removemenu = removemenuProcess;