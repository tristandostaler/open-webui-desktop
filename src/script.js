const webview = document.querySelector('webview');

async function main(){
    webview.src = await window.electron.getLocalStorage('open-webui-url');
}

main();