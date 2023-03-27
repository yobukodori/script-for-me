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
        You can also use comment style or comma expression style so that it will not cause an error when executed as javascript.
        ```
        //options  
        /* { "wrapCodeInScriptTag": true } */  
        ```
        or
        ```
        //options  
        0, { "wrapCodeInScriptTag": true }
        ```
  1. Content scripts and Page scripts  
  See [Content script environment](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#Content_script_environment).  
  This add-on executes the code as a content scripts.  
  To execute the code in the context of a page scripts, inject a script tag that wraps the code. The option **wrapCodeInScriptTag** does this for you.  
  **Without wrapCodeInScriptTag option**  
    [advantage]  
    　i. Can execute external script file specified in the //js section without CSP restrictions.  
    　ii. Can read cross-origin resources with xhr/fetch without CORS restrictions.  
    [disadvantage]  
    　i. Can't access the variables/functions/objects, etc. defined by the page script.   
  **With wrapCodeInScriptTag option**  
  You can access the variables/functions/objects, etc. defined by the page scripts. However, the above restrictions of CSP and CORS will apply.  
  1. Finally, write the code with the //js directive.  
  **[NOTE] Doesn't check the syntax of the code, so please paste the code that has been tested to work.**  
        ```
        //js  
        (function(){
          alert("hello");
        })();
        ```
  1. Simply write the URL and you can inject the script.  
  This add-on itself reads the script from the URL and executes the loaded code.  
        ```
        //js  
        https://yobukodori.github.io/foo.js  
        ```
        Internally convert it to the following code and execute it.  
        ```
        (function() {  
          let script = document.createElement("script");  
          script.src = "https://yobukodori.github.io/foo.js";  
          document.documentElement.appendChild(script);  
          script.remove();  
        })();  
        ```
  1. **//#include** preprocess-directive replaces this line with the contents of the file at the given url.
        ```
        //#include https://yobukodori.github.io/scrip-for-me-resource.js
        ```
        You can specify any part of the script resource as it is simply replaced before parsing.  
        
  1. Other directives. (Optional)  
  **//name**: This can be placed before the //matches directive.  
  **//disable**: disable this script. In case you don't use the script but want to keep it. You can temporarily enable this script from popup menu.  
  **//eof**: Ignore the lines that follow.    
  **//[-=*;#]**: Comment line. Excluding **//#include**.  
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
- **On** enables this feature. **Off** disables this feature. Or clicking on the syringe icon will bring up a pop-up menu where you can turn it on and off. From this menu you can temporarily turn individual scripts on or off.
- **Clear Log**: Clear log.
