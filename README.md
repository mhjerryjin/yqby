##有求必应
***  
#####微信处理接口地址：http://yqby.mingdao.net  
***

mainUserkey: 'yqby_user'  
存储用户信息的key，field是用户编号，value同时存储用户发布的需求的编号和被分配到的需求编号，HASH

allQueskey: 'yqby_ques'  
所有存储需求池子的key，field是需求编号，value是需求具体内容，HASH

unAssignedQueskey: 'yqby_ques_unas'  
尚未被分派的需求池子的key，value是需求的编号与发布作者的JSON，位LIST，JSON 格式如下  
`{
	qid: id,
	user: userid
}`

assignedQueskey: 'yqby_ques_as'  
已经被分配的需求池子的key，filed是需求编号，value是被分配的用户编号，HASH

accesstokenKey: 'yqby_wxat'  
暂存的accessToken，String