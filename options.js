let dummy_log_cleared;

function clearLog()
{
	let log = document.querySelector('#log');
	log.innerHTML = "";
	log.appendChild(document.createElement("span"));
}

function log(s)
{
	let log = document.querySelector('#log');
	if (! dummy_log_cleared){
		log.innerHTML = "";
		log.appendChild(document.createElement("span"));
		dummy_log_cleared = true;
	}
	if (! (s = s.replace(/\s+$/, ""))){
		return;
	}
	let className = /^error\b/i.test(s) ? "error" : /^warning\b/i.test(s) ? "warning" : "";
	let a = s.split("\n");
	for (let i = a.length - 1 ; i >= 0 ; i--){
		let s = a[i].replace(/\s+$/, "");
		let e = document.createElement("span");
		let col = 0, indent = 0;
		while (s[0] === '\t' || s[0] === ' '){
			indent += s[0] === ' ' ? 1 : col === 0 ? 4 : (4 - col % 4);
			s = s.substring(1);
		}
		e.appendChild(document.createTextNode((indent > 0 ? "\u00A0".repeat(indent) : "") + s));
		e.appendChild(document.createElement("br"));
		if (className){ e.classList.add(className); }
		log.insertBefore(e, log.firstElementChild);
	}
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
		if (document.querySelector('#printDebugInfo').checked){
			for (let i = scripts.length - 1 ; i >= 0 ; i--){
				log((i === 0 ? "----------\n" : "") 
					+ "scripts["+i+"] " + scriptToString(scripts[i])
					+ "\n----------");
			}
		}
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
		browser.storage.local.set(pref)
		.then(()=>{
			log("Settings and Scripts Resource saved.");
		})
		.catch(e=>{
			log("Error (storage.local.set): " + e);
		});
	}
	log("Applying settings and" + (scripts.length > 0 ? " " + scripts.length : " removing") +  " scripts.");
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
	else if (m.type === "statusChange"){
		onStatusChange(m.enabled);
		log(m.enabled ? "Enabled" : "Disabled");
	}
}

function getBackgroundStatus()
{
	browser.runtime.sendMessage({type: "getStatus"})
	.then(status=>{
		for (let i = status.scripts.length - 1 ; i >= 0 ; i--){
			let s = status.scripts[i];
			log((i === 0 ? "----------\n" : "") 
				+ (s.error ? "Error " : "") + "scripts[" + i + "]: " 
				+ (s.error ? s.error + '\n' : "") + scriptToString(s)
				+ "\n----------");
		};
		log("enabled:" + status.enabled + " debug:" + status.debug + " scripts:"
				+ status.scripts.length + " registered:" + status.registered.length);
		onStatusChange(status.enabled);
	})
	.catch (err=>{
		log("Error getBackgroundStatus:",err);
	});
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
	document.querySelector('#clearLog').addEventListener('click', ev=>{
		clearLog();
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

	browser.runtime.sendMessage({type: "getSettings"})
	.then(v=>{
        document.querySelector('#enableAtStartup').checked = v.enableAtStartup;
        document.querySelector('#printDebugInfo').checked = v.printDebugInfo;
		document.querySelector('#scriptsResource').value = v.scriptsResource;
	});
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
browser.runtime.onMessage.addListener(onMessage);
