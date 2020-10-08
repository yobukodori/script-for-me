let dummy_log_cleared;

function log(s)
{
	let e = document.createElement("span");
	e.innerText = s.replace(/\s+/g, ' ');
	e.appendChild(document.createElement("br"));
	if (/^error\b/i.test(s))
		e.className = "error";
	else if (/^warning\b/i.test(s))
		e.className = "warning";
	let log = document.querySelector('#log');
	if (! dummy_log_cleared){
		log.innerHTML = "";
		log.appendChild(document.createElement("span"));
		dummy_log_cleared = true;
	}
	log.insertBefore(e, log.firstElementChild);
}

function applySettings(fSave)
{
	let scriptsResource = document.querySelector('#scriptsResource').value;
	if (! /\S/.test(scriptsResource)){
		scriptsResource = "";
	}
	let scripts = [];
	if (scriptsResource){
		let res = parseScriptsResource(scriptsResource);
		if (res.error){
			log("error" + (res.line > 0 ? " line " + res.line : "") + ": " + res.error);
			return;
		}
		scripts = res.scripts;
	}
	let pref = {
		enableAtStartup : document.querySelector('#enableAtStartup').checked,
		printDebugInfo : document.querySelector('#printDebugInfo').checked,
		scriptsResource : scriptsResource
	};
	if (scripts.length === 0){
		log("warning: All current registered scripts will be removed");
	}
	if (fSave){
		browser.storage.sync.set(pref)
		.then(()=>{
			log("Settings and Scripts Resource saved.");
		})
		.catch(e=>{
			log("Error (storage.sync.set): " + e);
		});
	}
	log("Applying settings and" + (scripts.length > 0 ? "" : " removing") +  " scripts.");
	browser.runtime.sendMessage({type:"updateSettings",pref:pref});
}

let g_is_android = navigator.userAgent.indexOf('Android') > 0,	g_is_pc = ! g_is_android;

function onStatusChange(fEnabled)
{
	let e = document.querySelector('#toggle');
	e.className = (fEnabled ? "on" : "off") + " " + (g_is_pc ? "pc" : "mobile");
	e.innerText = fEnabled ? "Off (Now On)" : "On (Now Off)";
}

function onMessage(m, sender, sendResponse)
{
	if (m.type === "log"){
		log(m.str);
	}
	else if (m.type === "status"){
		let s = m["status"];
		log("enabled:"+s.enabled+" debug:"+s.debug+" scripts:"+s.scripts.length);
		s.scripts.forEach((s,i)=>{
			log(i + ") " + scriptToString(s).replace(/\s+/g, " "));
		});
		onStatusChange(s.enabled);
	}
	else if (m.type === "statusChange"){
		onStatusChange(m.enabled);
		log(m.enabled ? "Enabled" : "Disabled");
	}
}

function getBackgroundStatus()
{
	browser.runtime.sendMessage({type: "getStatus"});
}

function onDOMContentLoaded()
{
	getBackgroundStatus();
	document.querySelector("#scriptsResource").addEventListener('keydown', ev=>{
		if (ev.key == 'Tab') {
			ev.preventDefault();
			let e = ev.target;
			var start = e.selectionStart, end = e.selectionEnd;
			e.value = e.value.substring(0, start) + "\t" + e.value.substring(end);
			e.selectionStart = e.selectionEnd = start + 1;
		}
	});	
	document.querySelector('#save').addEventListener('click', ev=>{
		applySettings(true);
	});
	document.querySelector('#apply').addEventListener('click', ev=>{
		applySettings();
	});
	document.querySelector('#getStatus').addEventListener('click', ev=>{
		getBackgroundStatus();
	});
	document.querySelector('#toggle').addEventListener('click', ev=>{
		browser.runtime.sendMessage({type: "toggle"});
	});

	let e = document.querySelectorAll(".main, input, textarea, button, #log");
	for (let i = 0 ; i < e.length ; i++){
		e[i].classList.add(g_is_pc ? "pc" : "mobile");
	}
	document.getElementById("scriptsResource").placeholder = ''
		+ '//matches https://www.google.com/*\n'
		+ '//js\n'
		+ '(function(){\n'
		+ '    "1st script";\n'
		+ '})();\n'
		+ '//matches https://github.com/*,https://bit.ly/*\n'
		+ '//options\n'
		+ '{\n'
		+ '    "runAt": "document_start"\n'
		+ '}\n'
		+ '//js\n'
		+ '(function(){\n'
		+ '    "2nd script";\n'
		+ '})();'
		;

    browser.storage.sync.get(['enableAtStartup', 'printDebugInfo', 'scriptsResource'])
    .then((pref) => {
        document.querySelector('#enableAtStartup').checked = pref.enableAtStartup || false;
        document.querySelector('#printDebugInfo').checked = pref.printDebugInfo || false;
		if (typeof pref.scriptsResource === "string" && /\S/.test(pref.scriptsResource))
			document.querySelector('#scriptsResource').value = pref.scriptsResource;
    });
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
browser.runtime.onMessage.addListener(onMessage);
