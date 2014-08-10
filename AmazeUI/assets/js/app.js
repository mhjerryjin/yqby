(function() {

  var sendComment = function(message){};

  $('#send').on('click',function(){
    var myComment = $.trim($('#myComment').val());
    if(myComment){
      $('#myComment').val('');
    }
  });

  var loading = $('#my-modal-loading');
  var tpl = $('#tplComment').html();
  var $comments = $('#comments');
  var addComment = function(comment){
    $item = $(tpl);
    $item.find('.am-comment-avatar').attr('src', comment.avatar);
    $item.find('.am-comment-bd').html(comment.message);
    $comments.append($item);
  };
  loading.on('opened:modal:amui', function(){
      $.get('test.json', function(data){
        data = JSON.parse(data);
        for(var i = 0, l = data.length; i < l; i++){
          addComment(data[i]);
        }
        
        loading.modal('close');
      });
  });
  
  loading.modal('open');
  
})(window.Zepto);
