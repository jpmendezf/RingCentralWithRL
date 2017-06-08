/*
 * util methods
 */
Utils={
		
};
Utils.showLoading = function(){
	$("#loadingDiv").show();
}
Utils.hideLoading = function(){
	$("#loadingDiv").hide();
}
Utils.successMsg = function(message){
	$('.successMsg').text(message);
	 $('.successMsg').slideDown(function() {
			$('.successMsg').delay(3000).slideUp();
			});
}
Utils.moveToolTip = function(obj){
	
	var thumbNailImg = $($(obj).find("img")[0])
	$(thumbNailImg).css({top:mousePos.getY()+15,left:mousePos.getX()+15});
	
}
Utils.RenderTemplate=function(templateId , data,callBack){
	var template = $("#"+templateId).html();
	var compiledTemplate = Handlebars.compile(template);
	var widgetsDiv =$("#contentDiv");
	widgetsDiv.html(compiledTemplate(data));
	if(callBack)
	{
		callBack();
	}
};
var GHandler={
		ApiSpec:{
			getFiles : "ringcentral1.googledrive.getfiles",
			uploadFile: "ringcentral1.googledrive.uploadfile",
			getFileInfo: "ringcentral1.googledrive.getfileinfo"
		},
		MetaSpec:{
			folderID : "Street"
		},
		Session:{
			
		}
}
GHandler.widgetInit = function(){
	Utils.showLoading();
	GHandler.refreshFileList();
};
GHandler.refreshFileList = function(){
	
	
	ZOHO.CRM.INTERACTION.getPageInfo()
	.then(GHandler.getFolderInfo)
	.then(GHandler.getFiles)
	.then(GHandler.renderFileListNew)
	.then(function(data){
		var templateData = {
				files  : data
		}
		//console.log(templateData);
		Utils.RenderTemplate("fileListing",templateData,Utils.hideLoading)
	})
}
GHandler.getFolderInfo = function(pageInfo){

	/*
	 * Check for folderID
	 */
	var folderID = pageInfo.data[GHandler.MetaSpec.folderID]
	GHandler.Session.pageInfo = pageInfo;
	/*
	 * CreateFolder if no folderID is present in the record
	 */
	if(!folderID){
		return GHandler.createFolder(pageInfo)
	}
	else{
		GHandler.Session.folderID = folderID;
		return folderID;
	}
};
GHandler.createFolder = function(response){
	var module = response.entity;
	var rdata = response.data;
	var data = {
		    "CONTENT_TYPE":"multipart",
		    "PARTS":[
		              {
		                  "headers": {  
		                      "Content-Type": "application/json"
		                  },
		                  "content": {"mimeType": "application/vnd.google-apps.folder", "title": rdata.id
		                  }
		              }
		            ]
		  }
	return ZOHO.CRM.CONNECTOR.invokeAPI(GHandler.ApiSpec.uploadFile,data)			
	.then(function(response){
		
		var temp = response;
		var googleDriveResp = JSON.parse(temp.response);
		var folderID = googleDriveResp.id;
		GHandler.Session.folderID = folderID;
		return folderID;
	}).then(function(folderID){
		
		var updateData = {
		        "id": rdata.id,
		  };
		updateData[GHandler.MetaSpec.folderID] = folderID
		var config={
				  Entity:module,
				  APIData:updateData
				}
		return ZOHO.CRM.API.updateRecord(config).then(function(data){
			if(data && data instanceof Array && data[0].code === "SUCCESS"){
				return folderID;
			}
			else{
				return undefined;
			}
		})
	})
};
GHandler.getFiles = function(folderID){
	return ZOHO.CRM.CONNECTOR.invokeAPI(GHandler.ApiSpec.getFiles,{folderId:folderID})
	.then(function(gDriveResp){
		var resp = JSON.parse(gDriveResp.response)
		var files = resp.items;
		return files;
	})
};
GHandler.renderFileListNew = function(files){
	var allFiles =[];
	var pRes;
	return GHandler.getFileInfo(files)
	.then(function(data){
		return data;
	});
}
GHandler.getFileInfo = function(files,allFiles,callBack){
	
	var promises=[];
	for(file in files){
		var filePromise = ZOHO.CRM.CONNECTOR.invokeAPI(GHandler.ApiSpec.getFileInfo,{fileID:files[file].id}).then(function(data){
			return JSON.parse(data.response)
		});
		promises.push(filePromise); 
	}
	return Promise.all(promises);
}
GHandler.uploadFile = function(blob,calledNumber,folderId){
	debugger;
	var uploadresolve = undefined;
	var newPromise = new Promise(function(resolve,reject){
		uploadresolve = resolve;
	});
	if(blob){
		var file = blob;
		file.name= calledNumber+".mp3";
		GHandler.Session.folderID = folderId;
	}
	else
	{
		Utils.showLoading();
		var file = $("#gdrive-file")
		var file = document.getElementById("gdrive-file").files[0];
	}
	var fileType;
	  if (file.type === "application/pdf"){
	    fileType = file.type;
	  }
	  else if(file.type === "image/jpeg"){
	    fileType = file.type;
	  }
	  else if(file.type === "text/plain"){
	    fileType = "application/msword";
	  }
	  else if(file.type === ""){
	    fileType = "application/msword";
	  }
	  else if(file.type=="audio/mp3"){
	  	fileType=file.type
	  }
	  var data = {
	    "CONTENT_TYPE":"multipart",
	    "PARTS":[
	              {
	                "headers": {  
	                  "Content-Type": "application/json"
	                },
	                "content": {"mimeType": fileType,"description": "TestFile to upload", "title":file.name,"parents":[{id:GHandler.Session.folderID}]}
	              },{
	                "headers": {
	                  "Content-Disposition": "file;"
	                },
	                "content": "__FILE__"
	              }
	            ],
	    "FILE":{
	      "fileParam":"content",
	      "file":file
	    },
	  }

	  ZOHO.CRM.CONNECTOR.invokeAPI(GHandler.ApiSpec.uploadFile,data)
	  .then(function(){
	  	if(blob){
	  		uploadresolve();
	  	}
	  	else
	  	{
	 		GHandler.refreshFileList();
	 	}
	  })
	  return newPromise;
}