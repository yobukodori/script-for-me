function truncate(str, maxLength){
	maxLength = maxLength || 100;
	return str.length > maxLength ? 
		(str.substring(0, maxLength/2) + " <OMIT> " + str.substring(str.length - maxLength/2))
		: str;
}

function isString(v){
	return typeof v === 'string' || (typeof v !== "undefined" && v instanceof String);
}

function scriptToString(s, maxCodeLength)
{
	maxCodeLength = maxCodeLength || 100;
	if (s == null){
		return "(null)";
	}
	if (s.js == null){
		return "(not script)";
	}
	return ""
			+ (s.module ? "module: " + s.module + "\n" : "")
			+ (s.name != null ? "name: " + (s.name ? s.name : "(untitled)") + "\n" : "")
			+ (s.matches ? "matches: [" + s.matches + "]\n" : "")
			+ (s.require ? "require: [" + s.require + "]\n" : "")
			+ (s.options ? "options: " + JSON.stringify(s.options) + "\n" : "")
			+ ("js: " + truncate(s.js, maxCodeLength));
}

function parseScriptsResource(scriptsResource)
{
	function what(s){
		if (typeof s === "undefined"){
			return {type: "directive", name: "eof"};;
		}
		if (/^\/\/[;#\-=\*]/.test(s)){
			return { type: "comment" };
		}
		let r = s.match(/^\/\/([a-z]\w+)(\s|$)/i);
		if (r){
			let name = r[1].toLowerCase(), value = s.substring(r[1].length+2).trim();
			return {type: "directive", name: name, value: value}; 
		}
		return { type: "code" }; 
	}
	let res = {error: null, line: 0, scripts: [], modules: {}, scriptCount: 0, moduleCount: 0, require: []};
	if (! isString(scriptsResource)){
		res.error = "scriptsResource must be string: " + typeof scriptsResource;
		return res;
	}
	let rules = {
		initial: {
			followingDirectives: ["module", "name", "matches", "disable", "require", "options", "js"],
		},
		module: {
			has: "value",
			followingDirectives: ["js"],
			onclose: function(val, line){
				if (val in res.modules){
					return "The module name \"" +  val + "\" has been multiply defined.";
				}
				return null;
			},
		},
		name: {
			has: "value",
			followingDirectives: ["matches", "disable", "require", "options", "js"],
		},
		matches: {
			required: true,
			has: "value",
			type: "comma separated",
			defaultValue: ["*://*/*"],
			alt: "module",
			followingDirectives: ["disable", "require", "options", "js"],
		},
		disable: {
			followingDirectives: ["require", "options", "js"],
		},
		require: {
			has: "value",
			type: "comma separated",
			followingDirectives: ["disable", "options", "js"],
			onclose: function(val, line){
				for (let i = 0 ; i < val.length ; i++){
					let name = val[i];
					if (/^https?:/.test(name)){
						try { new URL(name); }
						catch(e){ return e.message; }
					}
					else {
						res.require.push({name, line});
					}
				}
				return null;
			},
		},
		options: {
			has: "code",
			type: "json",
			followingDirectives: ["disable", "require", "js"],
		},
		js: {
			closeScript: true,
			required: true,
			has: "code",
			followingDirectives: ["module", "name", "matches", "disable", "require", "options", "js"],
			onclose: function(val, line){
				let url = val.trim();
				if (/^https?:/.test(url)){
					try { new URL(url); }
					catch(e){ return e.message; }
				}
				return null;
			},
		}
	};
	Object.keys(rules).forEach(k=>{ rules[k].name = k; });
	let a = scriptsResource.split('\n'), script, rule = rules.initial;
	if (a.length > 0 && a[a.length - 1].length === 0){
		a.pop();
	}
	for (let i = 0 ; i <= a.length ; i++){
		res.line = i + 1;
		let s = a[i], w = what(s);
		if (w.type === "comment"){
			continue;
		}
		if (w.type === "directive"){
			if (rule.has === "code"){
				script[rule.name] = script[rule.name].join('\n');
			}
			if (rule.type === "json"){
				let json = script[rule.name].trim();
				if (json.startsWith("0,")){
					json = json.substring(2);
				}
				else if (json.startsWith("/*")){
					if (! json.endsWith("*/")){
						res.error = "Unterminated comment. '*/' is missing."
						break;
					}
					json = json.slice(2, -2);
				}
				if (json.trim().length > 0){
					try {
						script[rule.name] = JSON.parse(json);
					}
					catch (e){
						res.error = e.message;
						break;
					}
				}
				else {
					script[rule.name] = {};
				}
			}
			else if (rule.type === "comma separated"){
				script[rule.name] = script[rule.name].split(',').map(e=>e.trim()).filter(e=>e.length > 0);
			}
			if (rule.onclose){
				res.error = rule.onclose(script[rule.name], res.line - 1);
				if (res.error){
					res.line--;
					break;
				}
			}
			if (rule.closeScript){
				Object.keys(rules).forEach(k=>{
					if (rules[k].required && ! (k in script)){
						if (! (rules[k].alt && rules[k].alt in script)){
							if (typeof rules[k].defaultValue !== "undefined"){
								script[k] = rules[k].defaultValue;
							}
							else {
								res.error = "//" + k + " is required.";
							}
						}
					}
				});
				if (res.error){
					break;
				}
				script._index = res.scripts.length;
				if (script.module){
					res.modules[script.module] = script.js;
					res.moduleCount++;
					res.scripts.push(script);
				}
				else {
					res.scriptCount++;
					res.scripts.push(script);
				}
				script = null;
			}
			if (w.name === "eof")
				break;
		}
		if (w.type === "directive"){
			if (! rule.followingDirectives.includes(w.name)){
				res.error = "unexpected directive //" + w.name;
				break;
			}
			rule = rules[w.name];
			if (! script){
				script = {};
			}
			if (typeof script[rule.name] !== "undefined"){
				res.error = "//" + rule.name + " has been defined multiple times."
				break;
			}
			if (rule.has === "value"){
				if (! w.value){
					res.error = "//" + rule.name + " requires value";
					break;
				}
				script[rule.name] = w.value;
			}
			else if (rule.has === "code"){
				script[rule.name] = [];
			}
			else {
				script[rule.name] = true;
			}
		}
		else if (w.type === "code"){
			if (rule.has !== "code"){
				res.error = "unexpected code line.";
				break;
			}
			script[rule.name].push(s);
		}
		else {
			res.error = "unknown line type " + w.type;
			break;
		}
	}
	if (! res.error){
		for (let i = 0 ; i < res.require.length ; i++){
			let name = res.require[i].name;
			if (! (name in res.modules)){
				res.error = "module \"" + name + "\" is not defined";
				res.line = res.require[i].line;
				break;
			}
		}
	}
	return res;
}

function parseScriptsResourceAsync(scriptsResource, get){
	let res = {};
	let ar = scriptsResource.split('\n'), include = [];
	ar.every((s, i)=>{
		if (res.error){ return; }
		if (/^\/\/#include\b/.test(s)){
			let url = s.substring(10).trim();
			try {
				let u = new URL(url);
				include.push({line: i, url});
			}
			catch(e){
				res.error = { source: "resource", line: i + 1, message: e.message}; 
				return;
			}
		}
		return true;
	});
	if (res.error){
		return Promise.resolve(res);
	}
	if (include.length === 0){
		let res = parseScriptsResource(scriptsResource);
		if (res.error){
			res.error = { source: "resource", line: res.line, message: res.error};
		}
		return Promise.resolve(res);
	}
	return new Promise((resolve, reject)=>{
		include.forEach(data => {
			data.promise = get(data.url);
		});
		let promises = include.map(e => e.promise);
		Promise.all(promises)
		.then(values =>{
			let diff = 0, pos = [{line:0, diff:0, start:0, length: 0, end:0}], srcLineCount = ar.length;
			include.push({line: ar.length, dummy:true}),  values.push("dummy data");
			values.every((text, i) =>{
				let prev = pos[pos.length - 1], data = include[i], start = data.line + diff, lines = text.split("\n");
				pos.push({line: prev.end - diff, diff, start: prev.end, length: start - prev.end, end: start});
				if (! data.url){ return false; }
				pos.push({line: data.line, diff, start, length: lines.length, end: start + lines.length, url: data.url});
				ar.splice(start, 1, ...lines);
				diff += lines.length - 1;
				return true;
			});
			pos = pos.filter(e => e.length > 0);
			include.pop(),  values.pop();
			let res = parseScriptsResource(ar.join("\n"));
			if (res.error){
				res.error = { source: "(unknown)", line: res.line, message: res.error };
				if (res.line > 0){
					let i = res.line - 1;
					let src = pos.find(p => i >= p.start && i < p.end);
					if (src){
						let line = (i - src.start + 1);
						res.error.line = src.url ? line : line + src.line;
						res.error.source = src.url || "resource";
					}
				}
			}
			return resolve(res);
		})
		.catch(e =>{
			let got, error = { source: "(unknown)", line: 0, message: "" + e};
			promises.forEach((p, i) =>{
				if (! got){
					p.catch(err =>{
						error.source = "resource", error.line = include[i].line + 1, error.message = "" + err;
						got = true;
					});
				}
			});
			return resolve({ error });
		});
	});
}
