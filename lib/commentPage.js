var fs = require('fs');
var path = reqire('path');
exports.comment = function(res, req){
  fs.readFile(path.join(__dirname, '../', 'AmazeUI/index.html'), function(err, html){
    res.writeHeader(200, {"Content-Type": "text/html"});  
    res.write(html);  
    res.end();  
  });
}