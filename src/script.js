const webview = document.querySelector('webview');

async function main(){
    let src = await window.electron.getLocalStorage('open-webui-url');
    if(src !== null || src !== '') {
        webview.src = src;
    } else {
        webview.src = 'https://openwebui.com/';
    }
}

main();