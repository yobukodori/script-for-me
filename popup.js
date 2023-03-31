function onDOMContentLoaded(platformInfo){
	let os = platformInfo.os, is_mobile = os === "android", is_pc = ! is_mobile,
		enableFuture = document.querySelector('#enable-future'),
		scriptList = document.querySelector('#script-list');
	function error(msg){
		let e = document.createElement("div");
		e.appendChild(document.createTextNode("Error: " + msg));
		document.body.insertBefore(e, document.body.firstChild);
	}
	function onEnableFutureChange(enable){
		enableFuture.checked = enable;
		scriptList.querySelectorAll("input").forEach(e => e.disabled = ! enable);
		enable ? scriptList.classList.remove("gray") : scriptList.classList.add("gray");
	}
	enableFuture.addEventListener('change', ev=>{
		browser.runtime.sendMessage({type: "toggle"});
	});
	document.querySelector('#settings').addEventListener('click', ev=>{
		if (is_mobile){
			let url = browser.runtime.getURL("options.html");
			browser.tabs.query({})
			.then(tabs=>{
				let found;
				for (let i = 0 ; i < tabs.length ; i++){
					let tab = tabs[i];
					if (tab.url === url){
						found = true;
						browser.tabs.update(tab.id, {active: true})
						.then(tab=>{ window.close(); })
						.catch(error);
						break;
					}
				}
				if (! found){
					browser.tabs.create({url: url})
					.then(tab=>{ window.close(); })
					.catch(error);
				}
			})
			.catch(error);
		}
		else {
			browser.runtime.openOptionsPage()
			.then(()=>{ window.close(); })
			.catch(error);
		}
	});

	document.querySelectorAll("body, input, textarea, button").forEach(e=>{
		e.classList.add(is_pc ? "pc" : "mobile");
	});

	browser.runtime.sendMessage({type: "getStatus"})
	.then(status=>{
		enableFuture.checked = status.enabled;
		if (status.scripts.length === 0){
			enableFuture.disabled = true;
			document.querySelector('label[for="enable-future"]').classList.add("gray");
		}
		else {
			status.scripts.forEach(s =>{
				let id = "s" + s._index, name = (function(name, max){
					return name.length > max ? name.substring(0, max - 1) + "..." : name;
				})(s.name || "script[" + s._index + "] " + s.matches.join(","), 40);
				let item = document.createElement("div"), e;
				e = document.createElement("input"), e.type = "checkbox", e.id = id,
					 (e.checked = !! s?.data?.registered), e.addEventListener('change', ev=>{
						browser.runtime.sendMessage({type: "enableScript", index: s._index, enable: ev.target.checked});
					}), item.appendChild(e);
				e = document.createElement("label"),  e.setAttribute("for", id), 
					e.textContent = name, item.appendChild(e);
				scriptList.appendChild(item);
			});
			onEnableFutureChange(status.enabled);
		}
	})
	.catch(error);
	
	browser.runtime.onMessage.addListener((message, sender, sendResponse)=>{
		if (message.type === "statusChange"){
			onEnableFutureChange(message.enabled);
		}
		else if (message.type === "registeredChange"){
			scriptList.querySelectorAll("input").forEach(e =>{
				let index = e.id.substring(1) * 1;
				e.checked = message.registered.includes(index);
			});
		}
	});
}

document.addEventListener('DOMContentLoaded', ev=>{
	browser.runtime.getPlatformInfo().then(onDOMContentLoaded);
});
