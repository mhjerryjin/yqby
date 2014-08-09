##有求必应
***  
#####微信处理接口地址：http://yqby.mingdao.net  
***

mainUserkey: 'yqby_user'  
存储用户信息的key，field是用户编号，value同时存储用户发布的需求的编号、已经完成的需求编号和被分配到的唯一的需求编号的JSON，HASH，JSON 格式如下  
`{
	ques: [],
	finished: [],
	assigned: id
}`

allQueskey: 'yqby_ques'  
所有存储需求池子的key，field是需求编号，value是需求具体内容的JSON，为HASH，JSON 格式如下  
`{
	id: 需求编号,
	time: 需求发布时间戳,
	type: 微信类型，文本、图片、语音等,
	msg: 不同类型有不同的字段属性，以上三个是必须的
}`

unAssignedQueskey: 'yqby_ques_unas'  
尚未被分派的需求池子的key，value是需求的编号与发布作者的JSON，为LIST，JSON 格式如下  
`{
	qid: id,
	user: userid
}`

assignedQueskey: 'yqby_ques_as'  
已经被分配的需求池子的key，filed是需求编号，value是被分配的用户编号，HASH

unConfirmedQueskey: 'yqby_ques_con'  
待用户回复确认才发布的任务集合的key，field是用户编号，value是需求具体内容，HASH
			
accesstokenKey: 'yqby_wxat'  
暂存的accessToken，String