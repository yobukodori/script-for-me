# Script for Me - firefox extension
## Injects JavaScript code into a page. A simple wrapper for the browser.contentScripts API.
## ウェブページにJavaScritを注入するFirefox拡張機能。browser.contentScripts APIの単純なラッパーです。
### Script for Me is available on [AMO](https://addons.mozilla.org/firefox/addon/script-for-me/).
### Usage
![screenshot](https://yobukodori.github.io/freedom/image/script-for-me-screenshot.jpg)
- **Enable at startup**: Enable this feature when the browser is started.  
- **Print debug info**:  Output debug information at the bottom of the Options tab.  
- **Script Resource**: Scripts to inject.    
  1. Each script begins with the //matches directive.  
The //matches directive specifies a comma-separated list of [URL patterns](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) for the pages where you want to inject the script.  
If the //matches directive are omitted, then ` *://*/* ` is used as the default value.
        ```
        //matches https://www.google.com/*, https://github.com/*
        //js
        (function(){/* code for google.com and github.com */})();
        //js
        (function(){/* code for any webpage */})();
        
        ```
  1. Next, use the //options directive to set [various options](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/contentScripts/register). (Optional)  
        ```
        //options  
        {  
          "css":[{"code":"body{background-color:red;}"}],
          "runAt": "document_end",  
          "wrapCodeInScriptTag": true
        }
        ```
        **wrapCodeInScriptTag** is a Script For Me specific option. If its value is true, the code is wrapped in a script tag and executed. Then you can access the variables defined by page script.  
Internally convert it to the following code and execute it. Actually, the variable name ` script ` replaced by a random name.  
        ```
        (function() {  
          let script = document.createElement("script");  
          script.appendChild(document.createTextNode("("+function(){  
            // your code  
          }+")();"));  
          document.documentElement.appendChild(script);  
          script.remove();  
        })();  
        ```
  1. Finally, write the code with the //js directive.  
  **[NOTE] Doesn't check the syntax of the code, so please paste the code that has been tested to work.**  
        ```
        //js  
        (function(){
          alert("hello");
        })();
        ```
  1. Other directives. (Optional)  
  **//name**: This can be placed before the //matches directive.  
  **//disable**: disable this script. In case you don't use the script but want to keep it.  
  **//eof**: Ignore the lines that follow.    
  **//[-=*;#]**: Comment line.    
        ```
        //name Obsolete script  
        //matches https://obsolete.site/*
        //disable
        //js  
        (function(){/* code */})();  
        //===========================
        //matches *://abitdirtypage.com/*  
        //# comment
        //js  
        (function(){/* code */})();  
        //---------------------------  
        //; comment  
        //eof  
        //matches *://leavemealone.com/*  
        ```
- **Save**: Save settings and scripts resource. And apply settings and scripts.
- **Apply**: Apply settings and scripts. (doesn't save).
- **Get Status**: get current status and applied scripts.
- **On** enables this feature. **Off** disables this feature. Or clicking on the syringe icon will bring up a pop-up menu where you can turn it on and off. 
- **Clear Log**: Clear log.
