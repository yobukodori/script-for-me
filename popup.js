function onDOMContentLoaded(platformInfo){
	let os = platformInfo.os, is_mobile = os === "android", is_pc = ! is_mobile;
	console.log("is_pc:",is_pc,"is_mobile:",is_mobile);
	document.querySelector('#enable-future').addEventListener('change', ev=>{
		browser.runtime.sendMessage({type: "toggle"});
	});
	document.querySelector('#settings').addEventListener('click', ev=>{
		browser.runtime.openOptionsPage()
		.then(()=>{
			if (is_pc){
				window.close();
			}
		})
		.catch(err=>{
			document.body.insertBefore(
				document.createTextNode("Error: " + err), document.body.firstChild);
		});
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

document.addEventListener('DOMContentLoaded', ev=>{
	browser.runtime.getPlatformInfo().then(onDOMContentLoaded);
});
