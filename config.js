var config = {
    server: {
        port: 3000
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        storage: {
            mainkey: 'yqby_weixin',
            mainMDkey: 'yqby_user_weixin',
            userPrefix: 'yqby_user_',//hash 跟userid, 用户
            taskPrefix: 'yqby_task_',//hash 跟随机生成的taskid, 需求
            userInputStatusPrefix: 'yqby_user_inputstatus_',//用户发送消息的目的，比如发布需求
            taskDesInputPrefix: 'yqby_task_des_',//list 跟userid, 正在发送的需求
            taskAvailable: 'yqby_task_available',//set 未分配的需求
            taskAssigned: 'yqby_task_assigned',//set 已分配的需求
            accesstokenKey: 'yqby_wxat'
        },
        //用户上次操作有效时间
        userlpExpiretime: 5,
        //用户加入的群组时间
        usergroupExpiretime: 480,
        //获取的访问令牌有效期
        accesstokenExpiretime: 60
    },
    inputstatus: {
        default: 0,
        post_task: 1, // 正在分段发送需求
        wait_for_deadline: 2 //点击发布完成，等待输入截止时间
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
            eventkey13: 'post_task_cancel',
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