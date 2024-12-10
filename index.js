const {app, Tray, Menu, shell, BrowserWindow, globalShortcut, screen, ipcMain} = require('electron'),
      path = require('path'),
      Store = require('electron-store'),
      store = new Store();

let tray, openwebui, closeTimeout, visible = true;
let isQuitting = false; // Flag to track if the app is quitting

const exec = code => openwebui.webContents.executeJavaScript(code).catch(console.error),
    getValue = (key, defaultVal = false) => store.get(key, defaultVal);

const toggleVisibility = action => {
    visible = action;
    if (action){
        // clearTimeout(closeTimeout);
        openwebui.show();
    } else openwebui.hide()
    openwebui.webContents.send('toggle-visibility', action);
};

const registerKeybindings = () => {
    globalShortcut.unregisterAll();
    const shortcutA = getValue('shortcutA'),
        shortcutB = getValue('shortcutB');

    if (shortcutA) {
        globalShortcut.register(shortcutA, () => toggleVisibility(!visible));
    }

    if (shortcutB) {
        globalShortcut.register(shortcutB, () => {
            toggleVisibility(true);
            openwebui.webContents.send('activate-mic');
        });
    }
};

const setUrlForWebview = () => {
    const url = getValue('open-webui-url'); 
    if(url) exec(`document.querySelector('webview').src = '${url}'`);
}

const createWindow = () => {
    const {width, height} = screen.getPrimaryDisplay().bounds,
        winWidth = 976, winHeight = 600;

    openwebui = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        frame: true,
        movable: true,
        maximizable: true,
        resizable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        transparent: false,
        autoHideMenuBar: true,
        x: (width / 2) - (winWidth / 2) - 10,
        y: height - winHeight - 60,
        icon: path.resolve(__dirname, 'splash.png'),
        show: getValue('show-on-startup', true),
        webPreferences: {
            contextIsolation: true,
            devTools: true,
            nodeIntegration: true,
            webviewTag: true,
            preload: path.join(__dirname, 'src/preload.js')
        }
    });

    openwebui.loadFile('src/index.html').catch(console.error);

    openwebui.on('blur', () => {
        if (!getValue('always-on-top', false)) toggleVisibility(false);
    });

    ipcMain.handle('get-local-storage', (event, key) => getValue(key));

    ipcMain.on('set-local-storage', (event, key, value) => {
        store.set(key, value);
        registerKeybindings();
        setUrlForWebview();
    });

    ipcMain.on('close', event => {
        BrowserWindow.fromWebContents(event.sender).close();
    });

    openwebui.on('close', event => {
        if (!isQuitting) {
            event.preventDefault(); // Prevent closing the window when the X is pressed
            toggleVisibility(false); // Hide the window instead
        }
        isQuitting = false;
    });
};

const createDialog = () => {
    const dialog = new BrowserWindow({
        width: 500,
        height: 370,
        frame: false,
        maximizable: false,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'components/setKeybindingsOverlay/preload.js')
        }
    });
    dialog.loadFile('components/setKeybindingsOverlay/index.html').catch(console.error);
    dialog.hide();
    return dialog;
}

const createTray = () => {
    tray = new Tray(path.resolve(__dirname, 'splash.png'));
    var dialog = createDialog();

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'About (GitHub)',
            click: () => shell.openExternal('https://github.com/tristandostaler/open-webui-desktop').catch(console.error)
        },
        {type: 'separator'},
        {
            label: "Set Configs",
            click: () => {
                if(dialog.isDestroyed()) dialog = createDialog();
                dialog.show();
            }
        },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: getValue('always-on-top', false),
            click: menuItem => store.set('always-on-top', menuItem.checked)
        },
        {
            label: 'Show on Startup',
            type: 'checkbox',
            checked: getValue('show-on-startup', true),
            click: menuItem => store.set('show-on-startup', menuItem.checked)
        },
        {type: 'separator'},
        {
            label: 'Quit Open WebUI',
            click: () => {
                isQuitting = true; // Set the flag to indicate quitting
                openwebui.close(); // Close the window when this menu item is clicked
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => toggleVisibility(true));
};

app.whenReady().then(() => {
    createTray();
    createWindow();
    registerKeybindings();
}).catch(console.error);
