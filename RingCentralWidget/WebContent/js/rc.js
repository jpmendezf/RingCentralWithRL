// $Id$
var platform;
var sdk;
var sipInfo=null;
var webPhone;
var logLevel="0";
var status;
RC ={
        loggin	:	loginValidation(),
        extension : undefined,
        lastTimer:undefined
    }
function loginValidation()
{
		sdk = new RingCentral.SDK({
	            appKey: "Ypt9cnvIRUWiYcX31n1_HQ",
	            appSecret: "SCapn7-pR4ehgG2REOagHwX_ZagE6WSkCZdR0kTPGfIg",
	            server: "https://platform.ringcentral.com"
	        });

	    platform = sdk.platform();
	    platform.loggedIn().then(function(status) {
	    	if(status)
			{
	    		subscription();
	    		initWebRTC();
	    		return true;
			}
			else
			{
				return false;
			}
	    });
}
RC.config={
		Server:"https://platform.ringcentral.com",
		AppKey:"Ypt9cnvIRUWiYcX31n1_HQ",
		AppSecret:"SCapn7-pR4ehgG2REOagHwX_ZagE6WSkCZdR0kTPGfIg",
		LogLevel:"0"
}
RC.login =  function(server, appKey, appSecret) {

		var brandId;
        var authUri = platform.authUrl({
           redirectUri:'https://localhost:4443/html/Redirect.html',
   		brandId : brandId
        });
        var win   = window.open(authUri, 'windowname1', 'width=800, height=600');
};
RC.logOut =  function() {
	platform.logout();
};

function receiveMessage(e)
{
	var code;
	var temp=e.data.toString();
	if(temp.indexOf('code') >=0)//No I18N
	{
		code=temp.replace("code=","");
		redirectUri='https://localhost:4443/html/Redirect.html';
		platform.login({
			code:code,
			redirectUri:redirectUri
        })
        .then(subscription)
        .then(initWebRTC)
        .catch(function(e1) {
        	Handler.successMsg("Login Failed");
        	Handler.RenderTemplate("login",{Login:login,Pass:password});
        	console.log('Error in main promise chain'); //no i18n
            console.log(e1.stack || e1);
        });
	}
}

window.addEventListener("message", receiveMessage, false);

function initWebRTC()
{
	return platform.post('/client-info/sip-provision', {  // No i18n
            sipInfo: [{
                transport: 'WSS'// No i18n
            }]

		})
    .then(function(res) {
        return res.json();
    })
    .then(RC.register)
}

RC.register = function(data) {
    sipInfo = data.sipInfo[0] || data.sipInfo;
    webPhone = new RingCentral.WebPhone(data, {
        appKey: localStorage.getItem('webPhoneAppKey'), // no i18n//no i18n
        audioHelper: {
            enabled: true
        },
        logLevel: parseInt(logLevel, 1)
    });

    webPhone.userAgent.audioHelper.loadAudio({
        incoming: '../audio/incoming.ogg', // no i18n
        outgoing: '../audio/outgoing.ogg' // no i18n
    })

    webPhone.userAgent.audioHelper.setVolume(.5);

    webPhone.userAgent.on('invite', function(sessionArg) // no i18n
        {
    		Handler.rcIncomingCall(sessionArg);
        });
    webPhone.userAgent.on('connecting', function() {// no i18n
        console.log('UA connecting');// no i18n
    });
    webPhone.userAgent.on('connected', function() // no i18n
        {
    		RC.loggin = true;
            Handler.rcLogginSuccess();
        });
    return webPhone;
};
function subscription() {

    var subscription = sdk.createSubscription({detailed: true});
        subscription.on(subscription.events.notification, function(msg) {

        //console.log('subscription message', msg.body);
        var ActiveCalls = msg.body.activeCalls;
        //console.log('active calls', msg.body.activeCalls);
        var callstate = msg.body.telephonyStatus;
        //console.log('subscription message', msg.body.telephonyStatus);
        var currentCallSessionId = msg.body.activeCalls[0].sessionId;
        if(msg.body.telephonyStatus === "NoCall")
        {
            if(Handler.Data!=undefined && currentCallSessionId!=null && currentCallSessionId!=undefined)
            {
                url  = "/restapi/v1.0/account/~/extension/~/active-calls";
                platform.get(url).then(function(response){
                    var recentActivecalls = response.json().records;
                    for(var i=0;i<recentActivecalls.length;i++)
                    {
                       if(recentActivecalls[i].sessionId==currentCallSessionId)
                       {
                            var callDetails = recentActivecalls[i];
                            var recordingDetails = recentActivecalls[i].recording;
                            //console.log(recordingDetails);
                            if(recordingDetails!=undefined)
                            {
                                var recordingId = recordingDetails.id;
                                var chunks = [];
                                platform.get('/restapi/v1.0/account/~/recording/'+recordingId+'/content').then(function(response){
                                    //console.log(response);
                                    const reader = response._response.body.getReader();
                                    function pump() {
                                        return reader.read().then(({ value, done }) => {
                                            if (done) {
                                                return chunks;
                                            }
                                        chunks.push(value);
                                        return pump();
                                        });
                                    }
                                    return pump();
                                    }).then(function(chunks){
                                    var blob = new Blob(chunks, {
                                        type: 'audio/mp3'
                                    });
                                    if(drivestatus=="yes")
                                    {
                                        ZOHO.CRM.INTERACTION.getPageInfo().then(function(data){
                                            var pageInfo = data;
                                            var folderId =GHandler.getFolderInfo(pageInfo);
                                            GHandler.uploadFile(blob,Handler.callerInfo.Number,folderId).then(function(uploadstatus){
                                                ZOHO.CRM.UI.Record.open({Entity:Handler.Data.EntityType,RecordID:Handler.Data.EntityID});
                                            });
                                        });
                                    }
                                    if(attachmentstatus=="yes")
                                    {
                                        ZOHO.CRM.API.attachFile({Entity:Handler.Data.EntityType,RecordID:Handler.Data.EntityID,File:{Name:Handler.callerInfo.Number,Content:blob}}).then(function(result){
                                            ZOHO.CRM.UI.Record.open({Entity:Handler.Data.EntityType,RecordID:Handler.Data.EntityID});
                                        });
                                    }
                                });
                            }
                       }
                    }
                });

            }
        	Handler.Hangup();
        }
        });
        subscription.setEventFilters(['/account/~/extension/~/presence?detailedTelephonyState=true']).register().then(function(ajax) {//No I18n

    }).catch(function(e2) {
    		platform.on(platform.events.refreshError, function(){
    	        console.log('refreshError --->', arguments);
        });

    });

    }

RC.makeCall = function(number) {
    var homeCountry = (RC.extension && RC.extension.regionalSettings && RC.extension.regionalSettings.homeCountry) ?
    		RC.extension.regionalSettings.homeCountry.id :
        null;
	if(RC.lastTimer){
		window.clearInterval(RC.lastTimer);
		RC.lastTimer = undefined;
	}
    RC.lastTimer = setInterval(function() {
        var time = Handler.session.startTime ? (Math.round((Date.now() - Handler.session.startTime) / 1000)) : 'Connecting';
        var result = time;
        if('string' != typeof(time))
        	{
	        	var date = new Date(null);
	        	date.setSeconds(time);
	        	result = date.toISOString().substr(11, 8);
        	}
        $("#callTimer").text(result);
    }, 1000);
    Handler.session = webPhone.userAgent.invite(number, {
        media: {
            render: {
                remote: document.getElementById('remoteVideo'),
                local: document.getElementById('localVideo')
            }
        },
//        fromNumber: number,
//        homeCountryId: homeCountry

    });
    console.dir(Handler.session);
};
RC.answerCall = function(session,CallBack)
{
   var acceptOptions = {
           media: {
               render: {
                   remote: document.getElementById('remoteVideo'),
                   local: document.getElementById('localVideo')
                }
            }
        };
      session
      	.accept(acceptOptions).then(this.onAccepted(session,CallBack))
};
RC.onAccepted = function(session, CallBack)
{
    session.on('accepted', function() {
    	if(RC.lastTimer){
    		window.clearInterval(RC.lastTimer);
    		RC.lastTimer = undefined;
    	}
    	CallBack();
    	RC.lastTimer = setInterval(function() {
            var time = session.startTime ? (Math.round((Date.now() - session.startTime) / 1000)) : 'Connecting';
            var result = time;
            if('string' != typeof(time))
            	{
    	        	var date = new Date(null);
    	        	date.setSeconds(time);
    	        	result = date.toISOString().substr(11, 8);
            	}
            $("#callTimer").text(result);
        }, 1000);
    });
    session.on('progress', function() { console.log('Event: Progress'); });
    session.on('rejected', function() {
        console.log('Event: Rejected');
        close();
    });
    session.on('failed', function() {
        console.log('Event: Failed');
        close();
    });
    session.on('terminated', function() {
        console.log('Event: Terminated');
        close();
    });
    session.on('cancel', function() {
        console.log('Event: Cancel');
        close();
    });
    session.on('refer', function() {
        console.log('Event: Refer');
        close();
    });
    session.on('replaced', function(newSession) {
        console.log('Event: Replaced: old session', session, 'has been replaced with', newSession);
        close();
        RC.onAccepted(newSession);
    });
    session.on('bye', function() { close(); });
}
RC.getExtensionInfo= function(){
	return extension;
};
RC.getCallerInfo=function(){
	return callerInfo;
};
