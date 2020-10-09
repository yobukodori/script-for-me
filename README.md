# Script for Me - firefox extension
## Injects JavaScript code into a page. A simple wrapper for the browser.contentScripts API.
## ウェブページにJavaScritを注入するFirefox拡張機能。browser.contentScripts APIの単純なラッパーです。
<!--
### Script for Me is available on [AMO](https://addons.mozilla.org/firefox/addon/csp-for-me/).
-->
### Usage
![screenshot](https://yobukodori.github.io/freedom/image/script-for-me-screenshot.jpg)
- **Enable at startup**: Enable this feature when the browser is started.  
- **Print debug info**:  Output debug information at the bottom of the Options tab.  
- **Script Resource**: Scripts to inject.    
  1. Each script begins with the //matches directive.  
The //matches directive specifies a comma-separated list of [URL patterns](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) for the pages where you want to inject the script.  
        ```
        //matches https://www.google.com/*, https://github.com/*
        ```
  1. Next, use the //options directive to set [various options](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/contentScripts/register). (Optional)  
        ```
        //options  
        {  
          "css":[{"code":"body{background-color:red;}"}],
          "runAt": "document_end"  
        }
        ```
  1. Finally, write the code with the //js directive.  
  **[NOTE] Doesn't check the syntax of the code, so please paste the code that has been tested to work.**  
        ```
        //js  
        (function(){
          alert("hello");
        })();
        ```
- **Save**: Save settings and scripts resource. And apply settings and scripts.
- **Apply**: Apply settings and scripts. (doesn't save).
- **Get Status**: get current status and applied scripts.
- **On** enables this feature. **Off** disables this feature. Or clicking the syringe icon in toolbar toggles enable/disable. 
