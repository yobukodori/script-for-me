function alert(msg){
	const id = "alert";
	let e = document.getElementById(id);
	if(! e){
		e = document.createElement("div");
		e.id = id;
		setTimeout(function(e){
			document.addEventListener("click", function handler(ev){
				document.removeEventListener("click", handler);
				e.remove(); 
			});
		}, 0, e);
		document.body.appendChild(e);
	}
	let m = document.createElement("div");
	m.classList.add("message");
	msg.split("\n").forEach((line,i) =>{
		if (i > 0){ m.appendChild(document.createElement("br")); }
		let span = document.createElement("span");
		span.appendChild(document.createTextNode(line));
		m.appendChild(span);
	});
	e.appendChild(m);
}

function clearLog()
{
	let log = document.querySelector('#log');
	log.innerHTML = "";
	log.appendChild(document.createElement("span"));
}

function verbose(){
	return document.querySelector('#printDebugInfo').checked;
}

let dummy_log_cleared;

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

function goToLine(line){
	const ta = document.querySelector('#scriptsResource');
	let start = 0;
	if (line > 1){
		for (let ar = ta.value.split("\n"), i = 0 ; i < ar.length ; i++){
			start += ar[i].length + 1;
			if (i + 2 === line){ break; }
		}
	}
	ta.selectionStart = start, ta.selectionEnd = start;
	const computeLineHeight = function(){
		return getComputedStyle(ta).lineHeight.slice(0, -2) * 1;
	}
	ta.scrollTop = computeLineHeight() * (line - 1);
	ta.focus();
}

function goToScript(){
	let scriptsResource = document.querySelector('#scriptsResource').value;
	if (! /\S/.test(scriptsResource)){
		scriptsResource = "";
	}
	if (! scriptsResource){
		alert("error: no script");
		return;
	}
	let res = parseScriptsResource(scriptsResource);
	if (res.error){
		alert("error: " + res.error + " at line:" + res.line);
		return;
	}
	if (res.scripts.length === 0){
		alert("error: no script");
		return;
	}
	let modal = document.createElement("div");
	modal.classList.add("go-to-script-modal");
	modal.insertAdjacentHTML("beforeend", `<div class="title"><span>Go to script</span><button class="close">X</button></div><div class="container"></div>`);
	modal.querySelector('button.close').addEventListener("click", e =>{
		modal.remove();
	});
	let container = modal.querySelector(".container");
	container.style.maxHeight = Math.round(window.innerHeight * 0.88) + "px";
	res.scripts.forEach((s, i)=>{
		let name = (function(name, max){
			return name.length > max ? name.substring(0, max - 1) + "..." : name;
		})(s.name || s.matches.join(","), 40);
		let e = document.createElement("div");
		e.classList.add("item");
		e.textContent = "line " + s.position.start + ": " + name;
		e.addEventListener("click", ev =>{
			goToLine(s.position.start);
		});
		container.append(e);
	});
	document.addEventListener("click", function handler(ev){
		document.removeEventListener("click", handler);
		modal.remove();
	});
	document.body.append(modal);
}

async function applySettings(fSave)
{
	let scriptsResource = document.querySelector('#scriptsResource').value;
	if (! /\S/.test(scriptsResource)){
		scriptsResource = "";
	}
	let scripts = [], scriptCount = 0, moduleCount = 0;
	if (scriptsResource){
		let res = await parseScriptsResourceAsync(scriptsResource, function(url){
			return new Promise((resolve, reject)=>{
				browser.runtime.sendMessage({type: "httpGet", url})
				.then(data =>{
					data.error ? reject(data.error) : resolve(data.text);
				})
				.catch (err=>{
					reject("Error on httpGet: " + err);
				});
			});
		});
		if (res.error){
			let e = res.error;
			log("error: " + e.message + " at " + e.source + ":" + (e.line > 0 ? e.line : "n/a"));
			return;
		}
		scripts = res.scripts;
		scriptCount = res.scriptCount;
		moduleCount = res.moduleCount;
		if (verbose()){
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
		addLineNumbers: document.querySelector('#addLineNumbers').checked,
		scriptsResource : scriptsResource
	};
	if (scriptCount === 0){
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
	log("Applying settings" 
		+ " and " + (scriptCount > 0 ? scriptCount : "removing") +  " scripts."
		+ (moduleCount > 0 ? " And applying " + moduleCount + " modules." : ".")
	);
	browser.runtime.sendMessage({type:"updateSettings",pref:pref});
}

function onStatusChange(fEnabled)
{
	let e = document.querySelector('#toggle');
	e.classList.remove(fEnabled ? "off" : "on");
	e.classList.add(fEnabled ? "on" : "off");
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
		if (verbose()){
			for (let i = status.scripts.length - 1 ; i >= 0 ; i--){
				let s = status.scripts[i];
				log((i === 0 ? "----------\n" : "") 
					+ (s.error ? "Error " : "") + "scripts[" + i + "]: " 
					+ (s.error ? s.error + '\n' : "") + scriptToString(s)
					+ "\n----------");
			};
		}
		log("enabled:" + status.enabled + " debug:" + status.debug + " scripts:"
				+ status.scripts.length + " registered:" + status.registered.length);
		onStatusChange(status.enabled);
	})
	.catch (err=>{
		alert("Error on getStatus: " + err);
	});
}

function onDOMContentLoaded(platformInfo){
	let os = platformInfo.os, is_mobile = os === "android", is_pc = ! is_mobile;
	document.querySelector('#goToLine').addEventListener('click', ev=>{
		ev.stopPropagation();
		let line = parseInt(document.querySelector('#lineNumber').value);
		if (isNaN(line)){
			alert("invalid line number");
			return;
		}
		goToLine(line);
	});
	document.querySelector('#lineNumber').addEventListener('keyup', ev =>{
		if (ev.key == 'Enter') {
			document.querySelector('#goToLine').click();
		}
		else if (ev.key === "Escape"){
			let e = document.querySelector("#alert");
			e && e.click();
		}
	});
	document.querySelector('#goToScript').addEventListener('click', ev=>{
		ev.stopPropagation();
		goToScript();
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

	document.querySelectorAll("body, input, textarea, button, #log").forEach(e=>{
		e.classList.add(is_pc ? "pc" : "mobile");
	});

	const scriptsResource = document.getElementById("scriptsResource");
	scriptsResource.placeholder = ''
		+ '//matches https://www.google.com/*\n'
		+ '//js\n'
		+ '(function(){\n'
		+ '    // code\n'
		+ '})();'
		;
	textareaTabKeyToIndent(scriptsResource);
	
	const addLineNumbers = document.querySelector('#addLineNumbers');
	browser.storage.local.get(["addLineNumbers"])
	.then((pref) => {
		addLineNumbers.checked = pref.addLineNumbers || false
		addLineNumbers.checked && textareaAddLineNumbers(scriptsResource, true);
	})
	.catch(err=>{
		alert("Error (storage.local.get): " + e);
	});
	addLineNumbers.addEventListener("change", ev =>{
		textareaAddLineNumbers(scriptsResource, addLineNumbers.checked);
	});

	getBackgroundStatus();

	browser.runtime.sendMessage({type: "getSettings"})
	.then(v=>{
		if (v.error){
			alert("Error on getSettings: " + v.error);
		}
		else {
			document.querySelector('#enableAtStartup').checked = v.enableAtStartup;
			document.querySelector('#printDebugInfo').checked = v.printDebugInfo;
			document.querySelector('#scriptsResource').value = v.scriptsResource;
		}
	})
	.catch(err=>{
		alert("Error on sendMessage('getSettings'): " + err);
	});
}

browser.runtime.onMessage.addListener(onMessage);
document.addEventListener('DOMContentLoaded', ev=>{
	browser.runtime.getPlatformInfo().then(onDOMContentLoaded);
});
