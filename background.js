let my = {
	os : "n/a", // mac|win|android|cros|linux|openbsd
	defaultTitle: "Script for Me",
	initialized: false,
	enableAtStartup: false,
    enabled : false,
	debug: false,
	scriptsResource: "",
	scripts: [],
	scriptCount: 0,
	modules: {},
	cache: {},
	//====================================================
    init : function(platformInfo) 
	{
		my.initialized = new Promise((resolve, reject)=>{
			try {
				let man = browser.runtime.getManifest();
				if (man.browser_action && man.browser_action.default_title){
					my.defaultTitle = man.browser_action.default_title;
				}
				my.os = platformInfo.os;

				browser.browserAction.onClicked.addListener(function(){
					my.toggle();
				});
				my.updateButton();
				browser.runtime.onMessage.addListener(my.onMessage);

				browser.storage.local.get(['enableAtStartup', 'printDebugInfo', 'scriptsResource'])
				.then((pref) => {
					my.updateSettings(pref, pref.enableAtStartup);
					resolve();
				})
				.catch(err=>{
					reject(err);
				});
			}
			catch(e){
				reject(e.message);
			}
		});
    },
	//====================================================
	updateSettings : async function(pref, fEnable)
	{
		let disabled;
		my.enableAtStartup = pref.enableAtStartup || false;
		my.debug = pref.printDebugInfo || false;
		if (typeof pref.scriptsResource === "string"){
			if (pref.scriptsResource !== my.scriptsResource){
				if (my.enabled){
					my.toggle(false);
					disabled = true;
				}
				let res = await parseScriptsResourceAsync(pref.scriptsResource, my.get);
				if (res.error){
					my.scriptsResource = "";
					my.scripts = [];
					my.scriptCount = 0;
					my.modules = {};
					let e = res.error;
					my.log("Error: " + e.message + " at " + e.source + ":" + (e.line > 0 ? e.line : "n/a"));
				}
				else {
					my.scriptsResource = pref.scriptsResource;
					my.scripts = res.scripts;
					my.scriptCount = res.scriptCount;
					my.modules = res.modules;
				}
				my.log('my.scripts changed');
			}
		}
		if (disabled || (fEnable && ! my.enabled)){
			if (my.scriptCount > 0){
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
			sendResponse({
				enabled: my.enabled,
				debug: my.debug,
				scriptsResource: my.scriptsResource,
				scripts: my.scripts,
				registered: my.mapRegistered(),
			});
		}
		else if (message.type === "getSettings"){
			if (my.initialized){
				my.initialized.then(()=>{
					sendResponse({
						enableAtStartup: my.enableAtStartup,
						printDebugInfo: my.debug,
						scriptsResource: my.scriptsResource
					});
				})
				.catch(err=>{
					sendResponse({
						error: err,
					});
				});
				return true;
			}
			else {
				sendResponse({
					error: "background.js has not been initialized yet.",
				});
			}
		}
		else if (message.type === "updateSettings"){
			my.updateSettings(message.pref);
		}
		else if (message.type === "toggle"){
			my.toggle();
		}
		else if (message.type === "httpGet"){
			my.get(message.url)
			.then(text => sendResponse({ text }))
			.catch(err => sendResponse({ error: "" + err }));
			return true;
		}
		else if (message.type === "enableScript"){
			let index = message.index, s = my.scripts.find(s => s._index === index);
			if (! s){
				my.log("Error: Script with index " + index + " not found.");
				return;
			}
			if (! s.data){
				my.log("Error: scripts[" + index + "] has no registration data.");
				return;
			}
			let data = s.data;
			s.disable = ! message.enable;
			if (message.enable){
				if (! data.registered){
					try {
						data.registered = browser.contentScripts.register(data.options);
						data.registered.then(val => data.registered = val);
						if (my.debug){ my.log("## registered scripts[" + s._index + "]: " + data.title); }
						browser.runtime.sendMessage({type:"registeredChange", registered: my.mapRegistered()});
					}
					catch(e){
						s.error = e.message;
						my.log("Error register scripts[" + s._index + "]: " + e.message);
					}
				}
			}
			else {
				if (data.registered){
					data.registered.unregister();
					delete data.registered;
					if (my.debug){ my.log("## unregistered scripts[" + s._index + "]: " + data.title);}
					browser.runtime.sendMessage({type:"registeredChange", registered: my.mapRegistered()});
				}
			}
		}
	},
	//====================================================
	get: function (url){
		if (url in my.cache){
			return Promise.resolve(my.cache[url]);
		}
		return new Promise((resolve, reject)=>{
			if (my.debug){my.log("# fetching " + url);}
			fetch(url)
			.then(res=>{
				return res.ok ? res.text() : Promise.reject(res.status + ' ' + res.statusText + " while fetching " + url);
			})
			.then(text=>{ resolve(my.cache[url] = text); })
			.catch(err=>{ reject(err); });
		});
	},
	//====================================================
	mapRegistered: function(){
		return my.scripts.filter(s => s?.data?.registered).map(s => s._index);
	},
	//====================================================
    registerScripts : async function() 
	{
		let scripts = my.scripts.filter(s=> ! s.module);
		//scripts.forEach(async (s,i)=>{
		for (let i = 0 ; i < scripts.length ; i++){
			let s = scripts[i];
			let title = (function(name, max){
				return name.length > max ? name.substring(0, max - 1) + "..." : name;
			})(s.name || s.matches.join(","), 40);
			if (my.debug){ my.log("## registering scripts[" + s._index + "]: " + title + "\n-----------"); }
			let options = s.options ? Object.assign({}, s.options) : {}, code = "", wrapped;
			options.matches = s.matches;
			if (s.exclude){ options.excludeMatches = s.exclude; }
			if (s.css){ options.css = s.css; }
			if (s.require){
				for (let i = 0 ; i < s.require.length ; i++){
					let moduleName = s.require[i], url = moduleName;
					if (/^https?:/.test(url )){
						try {
							code += await my.get(url) + "\n";
						}
						catch(err){
							s.error = "" + err;
							my.log("Error: " + err);
							return;
						}
					}
					else {
						code += my.modules[moduleName] + "\n";
					}
				}
			}
			let url = s.js.trim();
			if (/^https?:/.test(url)){
				try {
					code += await my.get(url) + "\n";
				}
				catch(err){
					s.error = "" + err;
					my.log("Error: " + err);
					return;
				}
			}
			else {
				code += s.js;
			}
			if (typeof options.wrapCodeInScriptTag !== "undefined"){
				if (options.wrapCodeInScriptTag){
					wrapped = true;
					if (my.debug){ my.log("# wrapping code in script tag."); }
					let name = "_" + Math.random().toString().substring(2,10);
					code = '(function(){'
					+ 'let ' + name + ' = document.createElement("script"); '
					+ '' + name + '.appendChild(document.createTextNode(' + JSON.stringify(code) + ')); '
					+ 'document.documentElement.appendChild(' + name + '); ' + name + '.remove();'
					+ '})()';
				}
			}
			if (typeof options.wrapCodeInScriptTag !== "undefined"){
				if (my.debug){ my.log("# deleting options.wrapCodeInScriptTag"); }
				delete options.wrapCodeInScriptTag;
			}
			if (my.debug){
				my.log("# options: " + JSON.stringify(options));
				my.log((i === scripts.length - 1 ? "----------\n" : "") 
					+ "# code: " + truncate(code, wrapped ? 300 : 100));
			}
			options.js = [{code: code}];
			s.data = {title, options};
			if (s.disable){ continue; }
			try{
				s.data.registered = await browser.contentScripts.register(options);
				if (my.debug){ my.log("## registered scripts[" + s._index + "]: " + s.data.title); }
			}
			catch(e){
				s.error = e.message;
				my.log("Error register scripts[" + s._index + "]: " + e.message);
			}
		}
		browser.runtime.sendMessage({type:"registeredChange", registered: my.mapRegistered()});
	},
	//====================================================
    unregisterScripts : function() 
	{
		my.scripts.forEach(s =>{
			if (s?.data?.registered){
				s.data.registered.unregister();
				delete s.data.registered;
				if (my.debug){ my.log("## unregistered scripts[" + s._index + "]: " + s.data.title);}
			}
		});
		browser.runtime.sendMessage({type:"registeredChange", registered: []});
	},
	//====================================================
    toggle : function(state) 
	{
        if(typeof state === 'boolean') {
            my.enabled = state;
        }
        else {
			if (my.enabled = ! my.enabled){
				if (my.scriptCount === 0){
					my.enabled = false;
					my.log("error: no scripts");
					return;
				}
			}
        }

        my.updateButton();

        if(my.enabled) {
			my.registerScripts().then(()=>{
				if (my.mapRegistered().length > 0){
					browser.runtime.sendMessage({ type:"statusChange", enabled: my.enabled });
				}
				else {
					my.enabled = false;
					my.updateButton();
				}
			});
		}
        else {
			my.unregisterScripts();
			browser.runtime.sendMessage({ type:"statusChange", enabled: my.enabled });
        }
    },
	//====================================================
    updateButton : function() 
	{
        let buttonStatus = my.enabled ? 'on' : 'off';
		if (browser.browserAction.setIcon !== undefined){
			browser.browserAction.setIcon({path:{48:'icons/button-48-'+buttonStatus+'.png'}});
		}
    }
};

browser.runtime.getPlatformInfo().then(my.init);
