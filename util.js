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
	return (s.name != null ? "name: " + (s.name ? s.name : "(untitled)") + "\n" : "")
			+ (s.matches ? "matches: [" + s.matches + "]\n" : "")
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
	let res = {error: null, line: 0, scripts: []};
	if (! isString(scriptsResource)){
		res.error = "scriptsResource must be string: " + typeof scriptsResource;
		return res;
	}
	let rules = {
		initial: {
			followingDirectives: ["name", "matches", "options", "js"],
		},
		name: {
			has: "value",
			followingDirectives: ["disable", "matches", "options", "js"],
		},
		disable: {
			followingDirectives: ["name", "matches", "options", "js"],
		},
		matches: {
			required: true,
			has: "value",
			type: "comma separated",
			defaultValue: ["*://*/*"],
			followingDirectives: ["disable", "options", "js"],
		},
		options: {
			has: "code",
			type: "json",
			followingDirectives: ["disable", "js"],
		},
		js: {
			closeScript: true,
			required: true,
			has: "code",
			followingDirectives: ["name", "matches", "options", "js"],
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
			if (rule.closeScript){
				Object.keys(rules).forEach(k=>{
					if (rules[k].required && typeof script[k] === "undefined"){
						if (typeof rules[k].defaultValue !== "undefined"){
							script[k] = rules[k].defaultValue;
						}
						else {
							res.error = "//" + k + " is required.";
						}
					}
				});
				if (res.error){
					break;
				}
				if (script.disable){
					res.scripts.pop();
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
				res.scripts.push(script);
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
	return res;
}
