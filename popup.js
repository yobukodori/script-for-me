function onDOMContentLoaded()
{
	let is_android = navigator.userAgent.indexOf('Android') > 0, is_pc = ! is_android;
	
	document.querySelector('#enable-future').addEventListener('change', ev=>{
		browser.runtime.sendMessage({type: "toggle"});
	});
	document.querySelector('#settings').addEventListener('click', ev=>{
		browser.runtime.openOptionsPage();
		window.close();
	});

	document.querySelectorAll("body, input, textarea, button").forEach(e=>{
		e.classList.add(is_pc ? "pc" : "mobile");
	});

	browser.runtime.sendMessage({type: "getStatus"})
	.then(status=>{
		let checkbox = document.querySelector('#enable-future');
		checkbox.checked = status.enabled;
		if (status.scripts.length === 0){
			checkbox.disabled = true;
			document.querySelector('label[for="enable-future"]').classList.add("gray");
		}
	})
	.catch (err=>{
		document.querySelector(".main").textContent = "Error getStatus:" + err;
	});
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
