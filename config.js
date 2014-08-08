var config = {
    server: {
        port: 80
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        storage: {
            mainkey: 'yqby_weixin',
            mainMDkey: 'yqby_user_weixin',
            userlpPrefix: 'yqby_wx_',
            usergroupPrefix: 'yqby_wxug_',
            accesstokenKey: 'yqby_wxat'
        },
        //用户上次操作有效时间
        userlpExpiretime: 5,
        //用户加入的群组时间
        usergroupExpiretime: 480,
        //获取的访问令牌有效期
        accesstokenExpiretime: 60
    },
    weixin: {
        token: 'xxoo',
        appkey: 'wx21b41014a26161dd',
        appsecret: '9c3934bd17bfe6d7292c1c056435709d',
        api:
        {
            access_token: 'https://api.weixin.qq.com/cgi-bin/token',
            create_menu: 'https://api.weixin.qq.com/cgi-bin/menu/create',
            remove_menu: 'https://api.weixin.qq.com/cgi-bin/menu/delete',
            download_media: 'http://file.api.weixin.qq.com/cgi-bin/media/get',
            qrticket: 'https://api.weixin.qq.com/cgi-bin/qrcode/create',
            send_custom: 'https://api.weixin.qq.com/cgi-bin/message/custom/send',
            qrcode: 'https://mp.weixin.qq.com/cgi-bin/showqrcode',
            userinfo: 'https://api.weixin.qq.com/cgi-bin/user/info?lang=zh_CN'
        },
        menu: {
            eventkey11: 'post_task_start',
            eventkey12: 'post_task_end',
            eventkey21: 'my_task',
            eventkey31: 'personal_center'
        }
    },
    filepath: 'd:/weixin/',
    logpath: 'd:/log_weixin.txt'
};
exports.config = config;

var accessHandler = require("./lib/access");
var menuHandler = require("./lib/menu");
var handle = {};
handle["/"] = accessHandler.homepage;
handle["/access"] = accessHandler.access;
handle["/menu/create"] = menuHandler.createmenu;
handle["/menu/remove"] = menuHandler.removemenu;
exports.router = handle;