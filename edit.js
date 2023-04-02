function textareaTabKeyToIndent(ta){
	ta.addEventListener('keydown', ev=>{
		if (ev.key == 'Tab') {
			ev.preventDefault();
			let e = ev.target;
			var start = e.selectionStart, end = e.selectionEnd;
			e.value = e.value.substring(0, start) + "\t" + e.value.substring(end);
			e.selectionStart = e.selectionEnd = start + 1;
		}
	});
}

function textareaAddLineNumbers(ta, add){
	if (! add){
		if (ta.classList.contains("edit")){
			ta.classList.remove("edit");
			let table = ta.parentElement.parentElement.parentElement;
			table.before(ta), table.remove();
		}
		return;
	}
	if (ta.classList.contains("edit")){ return; }
	ta.classList.add("edit");
	let table = document.createElement("table"),
		tr = document.createElement("tr"),
		left = document.createElement("td"),
		right = document.createElement("td"),
		canvas = document.createElement('canvas');
	table.classList.add("edit", "container"), left.classList.add("left");
	left.append(canvas);
	tr.append(left, right), table.append(tr), ta.before(table), right.appendChild(ta);

	const numericFontRatio = 0.5, canvasCols = 5;
	const computeFontSize = function(){
		return getComputedStyle(ta).fontSize.slice(0, -2) * 1;
	}
	const computeLineHeight = function(){
		return getComputedStyle(ta).lineHeight.slice(0, -2) * 1;
	}
	const computeCanvasWidth = function(){
		return computeFontSize() * numericFontRatio * canvasCols;
	}
	
	left.width = canvas.width = computeCanvasWidth();
	canvas.height = ta.clientHeight;

	const paintLineNumber = function (){
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = getComputedStyle(ta).backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const s = getComputedStyle(ta);
		ctx.fillStyle = s.color;
		ctx.font = s.fontSize + " " + s.fontFamily;
		var lineHeight = computeLineHeight();
		var start = Math.floor(ta.scrollTop / lineHeight, 0);
		var end = start + Math.ceil(ta.clientHeight / lineHeight, 0);
		for (var i = start; i < end; i++){
			const text = "" + (i + 1);
			const x = canvas.width - (text.length * computeFontSize() * numericFontRatio) - 2;
			const y = - ta.scrollTop + lineHeight + lineHeight * i;
			ctx.fillText(text, x, y);
		}
	};
	
	new ResizeObserver((entries, observer) => {
		left.width = canvas.width = computeCanvasWidth();
		canvas.height = ta.clientHeight;
		paintLineNumber();
	}).observe(ta);
	
	ta.addEventListener("scroll", ev => paintLineNumber());
	paintLineNumber();
}
