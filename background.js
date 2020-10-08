let my = {
	os : "n/a", // mac|win|android|cros|linux|openbsd
	defaultTitle: "Script for Me",
    enabled : false,
	debug: false,
	scriptsResource: "",
	scripts: [],
	registered: [],
	//====================================================
    init : function(platformInfo) 
	{
		let man = browser.runtime.getManifest();
		if (man.browser_action && man.browser_action.default_title){
			my.defaultTitle = man.browser_action.default_title;
		}
		my.os = platformInfo.os;

        browser.browserAction.onClicked.addListener(function(){
            my.toggle();
        });

        browser.storage.sync.get(['enableAtStartup', 'printDebugInfo', 'scriptsResource'])
        .then((pref) => {
			my.updateSettings(pref, pref.enableAtStartup);
        });

        // update button
        my.updateButton();
		
		browser.runtime.onMessage.addListener(my.onMessage);
    },
	//====================================================
	updateSettings : function(pref, fEnable)
	{
		let disabled;
		my.debug = pref.printDebugInfo || false;
		if (typeof pref.scriptsResource === "string"){
			if (pref.scriptsResource !== my.scriptsResource){
				if (my.enabled){
					my.toggle(false);
					disabled = true;
				}
				let res = parseScriptsResource(pref.scriptsResource);
				if (res.error){
					my.scriptsResource = "";
					my.scripts = [];
					my.log("error" + (res.line > 0 ? " line " + res.line : "") + ": " + res.error);
				}
				else {
					my.scriptsResource = pref.scriptsResource;
					my.scripts = res.scripts;
				}
				my.log('my.scripts changed');
			}
		}
		if (disabled || (fEnable && ! my.enabled)){
			if (my.scripts.length > 0){
				my.toggle(true);
			}
		}
	},
	//====================================================
	log : function(str)
	{
		browser.runtime.sendMessage({type:"log",str:str});
	},
	//====================================================
	onMessage : function(message, sender, sendResponse)
	{
		if (message.type === "getStatus"){
			browser.runtime.sendMessage({
				type: "status",
				"status": {
					enabled: my.enabled,
					debug: my.debug,
					scriptsResource: my.scriptsResource,
					scripts: my.scripts
				}
			});
		}
		else if (message.type === "updateSettings"){
			my.updateSettings(message.pref);
		}
		else if (message.type === "toggle"){
			my.toggle();
		}
		else {
			my.log("unknown message type:" + message.type);
		}
	},
	//====================================================
    toggle : function(state) 
	{
        if(typeof state === 'boolean') {
            my.enabled = state;
        }
        else {
			if (my.enabled = ! my.enabled){
				if (my.scripts.length === 0){
					my.enabled = false;
					my.log("error: no scripts");
					return;
				}
			}
        }

        my.updateButton();

        if(my.enabled) {
			my.scripts.forEach((s,i)=>{
				let options = Object.assign({}, s.options);
				options.matches = s.matches;
				options.js = [{code: s.js}];
				try{
					browser.contentScripts.register(options)
					.then(registered=>{
						my.registered.push({script: s, registered: registered});
						if (my.debug) my.log("Registered scripts[" + i + "]: " + scriptToString(s));
					})
				}
				catch(e){
					my.log("error scripts[" + i + "]: " + e.message);
				}
			});
		}
        else {
			my.registered.forEach((r,i)=>{
				r.registered.unregister();
				if (my.debug) my.log("Unregistered registered[" + i + "]: " + scriptToString(r.script));
			});
			my.registered = [];
        }
		browser.runtime.sendMessage({
			type:"statusChange", enabled:my.enabled });
    },
	//====================================================
    updateButton : function() 
	{
        let buttonStatus = my.enabled ? 'on' : 'off';
		if (browser.browserAction.setIcon !== undefined)
			browser.browserAction.setIcon({path:{48:'icons/button-48-'+buttonStatus+'.png'}});
		if (browser.browserAction.setTitle !== undefined)
			browser.browserAction.setTitle({title: my.defaultTitle + " ("+buttonStatus+")"});
    }
};

browser.runtime.getPlatformInfo().then(my.init);
