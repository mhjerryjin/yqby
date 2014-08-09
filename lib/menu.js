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
                    "name": "找人帮忙",
                    "sub_button":
                    [{
                        "type": "click",
                        "name": "发布需求",
                        "key": config.weixin.menu.eventkey11
                    },
                    {
                        'type': "click",
                        "name": "发布完成",
                        "key": config.weixin.menu.eventkey12
                    },
                    {
                        'type': "click",
                        "name": "取消发布",
                        "key": config.weixin.menu.eventkey13
                    }]
                },
                {
                    "type": "click",
                    "name": "我要做的",
                    "key": config.weixin.menu.eventkey21
                },
                {
                    "type": "click",
                    "name": "个人中心",
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