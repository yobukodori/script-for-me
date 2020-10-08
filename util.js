function isString(v){
	return typeof v === 'string' || (typeof v !== "undefined" && v instanceof String);
}

function scriptToString(s)
{
	if (s == null){
		return "(null)";
	}
	if (! s.matches){
		return "(not script)";
	}
	return "matches: " + s.matches.join() + '\n'
			+ "options: " + JSON.stringify(s.options) + '\n'
			+ "js: " + s.js.substring(0,80);
}

function parseScriptsResource(scriptsResource)
{
	function isDirective(line, name){
		return new RegExp("^//" + name + "(\\s.*)?$").test(line);
	}
	let res = {error:"not implemented", line:0, scripts:[]};
	if (! isString(scriptsResource)){
		res.error = "scriptsResource must be string: " + typeof scriptsResource;
		return res;
	}
	let a = scriptsResource.split('\n');
	const initial = 0, after_matches = 1, after_options = 2, after_js = 3;
	let state = initial, directive = "n/a", script;
	for (let i = 0 ; i < a.length ; i++){
		let s = a[i];
		switch (state){
		case initial:
			if (isDirective(s, "matches")){
				res.line = i + 1;
				directive = "//matches";
				script = {
					matches: s.substring(9).split(',').map(v=>v.trim()).filter(v=>v.length > 0), 
					options: [],
					js: []
				};
				if (script.matches.length === 0){
					res.error = "//matches requires url";
					return res;
				}
				res.scripts.push(script);
				state = after_matches;
				continue;
			}
			else if (isDirective(s, "options") || isDirective(s, "js")){
				res.line = i + 1;
				res.error = "the first directive must be //matches.";
				return res;
			}
			continue;
		case after_matches:
			if (isDirective(s, "options")){
				res.line = i + 1;
				directive = "//options";
				state = after_options;
				continue;
			}
			else if (isDirective(s, "js")){
				res.line = i + 1;
				directive = "//js";
				script.options = {};
				state = after_js;
				continue;
			}
			else if (isDirective(s, "matches")){
				res.line = i + 1;
				res.error = "unexpected directive.";
				return res;
			}
			continue;
		case after_options:
			if (isDirective(s, "js")){
				script.options = script.options.join('\n');
				try {
					script.options = JSON.parse(script.options);
				}
				catch (e){
					res.line++;
					res.error = e.message;
					return res;
				}
				res.line = i + 1;
				directive = "//js";
				state = after_js;
				continue;
			}
			else if (isDirective(s, "matches") || isDirective(s, "options")){
				res.line = i + 1;
				res.error = "unexpected directive.";
				return res;
			}
			script.options.push(s);
			continue;
		case after_js:
			if (i + 1 === a.length){
				script.js.push(s);
				script.js = script.js.join('\n');
				state = initial;
				break;
			}
			else if (isDirective(s, "matches")){
				script.js = script.js.join('\n');
				state = initial;
				--i;
				continue;
			}
			else if (isDirective(s, "options") || isDirective(s, "js")){
				res.line = i + 1;
				res.error = "unexpected directive.";
				return res;
			}
			script.js.push(s);
			continue;
		}
	}
	res.error = (state === initial) ? "" : ("directive " + directive + " is not closed");
	return res;
}
