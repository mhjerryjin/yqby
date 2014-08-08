var config = {
    server: {
        port: 80
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        storage: {
            mainkey: 'md_weixin',
            mainMDkey: 'md_user_weixin',
            userlpPrefix: 'md_wx_',
            usergroupPrefix: 'md_wxug_',
            accesstokenKey: 'md_wxat'
        },
        //用户上次操作有效时间
        userlpExpiretime: 5,
        //用户加入的群组时间
        usergroupExpiretime: 480,
        //获取的访问令牌有效期
        accesstokenExpiretime: 60
    },
    weixin: {
        token: '',
        appkey: '',
        appsecret: '',
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
            eventkey11: 'md_share',
            eventkey12: 'md_appurl',
            eventkey13: 'md_contact',
            eventkey21: 'md_bind',
            eventkey31: 'md_about'
        }
    },
    filepath: 'd:/weixin/',
    logpath: 'd:/log_weixin.txt'
};
exports.config = config;

var accessHandler = require("./lib/access");
var bindHandler = require("./lib/bind");
var menuHandler = require("./lib/menu");
var mediaHandler = require("./lib/media");
var qrHandler = require("./lib/qr");
var handle = {};
handle["/"] = accessHandler.homepage;
handle["/access"] = accessHandler.access;
handle["/push"] = accessHandler.push;
handle["/bind"] = bindHandler.bind;
handle["/callback"] = bindHandler.callback;
handle["/menu/create"] = menuHandler.createmenu;
handle["/menu/remove"] = menuHandler.removemenu;
handle["/media/get"] = mediaHandler.getmedia;
handle["/qr/get"] = qrHandler.getqrcode;
handle["/qr/getcaptcha"] = qrHandler.getqrcodecaptcha;
handle["/qr/getcaptchavalue"] = qrHandler.getqrcodecaptchavalue;
handle["/code/get"] = qrHandler.getsessionqrcode;
handle["/code/confirm"] = qrHandler.confirmsessionqrcode;
handle["/code/pollings"] = qrHandler.pollingsessionscanedqrcode;
handle["/code/pollingc"] = qrHandler.pollingsessionconfirmedqrcode;
handle["/chat/"] = qrHandler.pollingsessionconfirmedqrcode;
exports.router = handle;