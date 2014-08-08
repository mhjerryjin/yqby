var redis = require("redis");
var rpc = require("./rpc");
var common = require("../common");
var config = require("../config").config;

//获取群组信息
function mygroupprocesscallback(token, userid, callback) {
    var redisClient = redis.createClient(config.redis.port, config.redis.host);
    var key = config.redis.storage.usergroupPrefix + userid;
    redisClient.get(key, function (err, groupsstr) {
        if (!common.IsNullOrEmpty(groupsstr)) {
            var groupObj = JSON.parse(groupsstr);
            callback(1, groupObj);
        }
        else {
            getusergroupinfo(token, function (status, result) {
                if (status == 1) {
                    var grouplist = { groups: [{ id: 0, gid: '', name: '所有关注者'}] };
                    var groupObj = JSON.parse(result);
                    if (groupObj.hasOwnProperty('error_code')) {
						common.Log('get groups err:' + userid + '/' + token + ' ' + result);
						callback(2, null);
					}
                    else {
                        for (var i = 0; i < groupObj.groups.length; i++) {
                            if (groupObj.groups[i].status.toString() == '1') {
                                var group = { id: (i + 1).toString(), gid: groupObj.groups[i].id, name: groupObj.groups[i].name };
                                grouplist.groups.push(group);
                            }
                        }
                        var mySelf = { id: '1111', gid: '', name: '我自己' };
                        grouplist.groups.push(mySelf);

                        redisClient.setex(key, config.redis.usergroupExpiretime * 60, JSON.stringify(grouplist), function (err, result) {
                            callback(1, grouplist);
                        });
                    }
                }
                else
                    callback(0, result);
            });
        }
    });
};

//从API获取加入群组信息
function getusergroupinfo(token, callback) {
    var request = require('request');
    var myjoinedgroupUri = config.mdapi.appuri.my_joined_group + '?access_token=' + token + '&format=json';
    request.get(myjoinedgroupUri, function (err, resp, result) {
        if (err) {
            common.Log(err);
            callback(0, '获取明道群组信息失败　' + err);
        }
        else if (resp.statusCode == 200) {
            callback(1, result);
        }
        else
            callback(0, '获取明道群组信息失败，服务器没有响应！');
    });
};

//返回用户选择群组信息
function getuserchoicedgroupinfo(txt, token, userid, callback) {
    var groups = { all: 0, my: 0, groups: '' };
    mygroupprocesscallback(token, userid, function (status, groupObj) {
        var arr = txt.split(',');
        if (!common.IsNullOrEmpty(groupObj.groups)) {
            for (var i = 0; i < groupObj.groups.length; i++) {
                for (var x = 0; x < arr.length; x++) {
                    if (!common.IsNullOrEmpty(arr[x]) && groupObj.groups[i].id == arr[x]) {
                        if (groupObj.groups[i].id == '0')
                            groups.all = 1;
                        else if (groupObj.groups[i].id == '1111')
                            groups.my = 1;
                        else
                            groups.groups += groupObj.groups[i].gid + ',';
                    }
                }
            }
        }
        if (!common.IsNullOrEmpty(groups.groups))
            groups.groups = groups.groups.substr(0, groups.groups.length - 1);

        callback(groups);
    });
};

exports.mygroupprocesscallback = mygroupprocesscallback;
exports.getuserchoicedgroupinfo = getuserchoicedgroupinfo;