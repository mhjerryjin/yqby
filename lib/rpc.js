var formData = require('form-data');
var request = require('request');
var fs = require('fs');

function postFormdataByUrifile(posturi, fields, uriFiles, callback) {
    var form = new formData();
    for (var field in fields) {
        form.append(field, fields[field]);
    }
    for (var uriFile in uriFiles) {
        form.append(uriFile, request(uriFiles[uriFile]));
    }

    formsubmit(form, posturi, callback);
};

function postFormdataByLocalfile(posturi, fields, localFiles, callback) {
    var form = new formData();
    for (var field in fields) {
        form.append(field, fields[field]);
    }
    for (var localFile in localFiles) {
        form.append(localFile, fs.createReadStream(localFiles[localFile]));
    }

    formsubmit(form, posturi, callback);
};

function formsubmit(form, posturi, callback) {
    form.submit(posturi, function (err, res) {
        if (err) {
            callback(err, '提交失败');
        }
        else if (res.statusCode == 200) {
            res.resume();
            callback(null, 'Success');
        }
        else {
            var log = '服务器错误 ' + res.statusCode.toString();
            callback(true, log);
        }
    });
};

exports.postUrifile = postFormdataByUrifile;
exports.postLocalfile = postFormdataByLocalfile;

