function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}

var me = {
  quesid: getQueryVariable('quesid'),
  avatar: getQueryVariable('avatar'),
  name: getQueryVariable('name')
}

(function() {


  $('#send').on('click',function(){
    var myComment = $.trim($('#myComment').val());
    if(myComment){
      $('#myComment').val('');
      sendComment(myComment);
    }
  });

  var loading = $('#my-modal-loading');
  var tpl = $('#tplComment').html();
  var $comments = $('#comments');

  var addComment = function(comment){
    var comment = typeof comment === 'string' ? JSON.parse(comment) : comment;
    $item = $(tpl);
    $item.find('.am-comment-avatar').attr('src', comment.avatar);
    $item.find('.am-comment-bd').html(comment.message);
    $comments.append($item);
  };

  var socket = io.connect('/');

  socket.on('comment', function(comment){
    addComment(comment);
  });

  var sendComment = function(message) {
    var comment = $.extend({}, me, {message: message});
    socket.emit('comment', comment);
  }

  loading.on('opened:modal:amui', function(){
      socket.emit('init', me);
  });

  socket.on('comments', function(comments){
    for(var i = 0, l = comments.length; i < l; i++){
      addComment(comments[i]);
    }
    
    loading.modal('close');
  })
  
  loading.modal('open');
  
})(window.Zepto);
