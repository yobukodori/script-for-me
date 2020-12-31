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
				let json = script[rule.name];
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
					if (! script.disable){
						res.scriptCount++;
						res.scripts.push(script);
					}
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
