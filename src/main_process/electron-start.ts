import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  ipcRenderer,
  MessageChannelMain,
  systemPreferences,
} from 'electron';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import Store from 'electron-store';
import * as menu from './menu';
import { v4 as uuidv4 } from 'uuid';

const extraResourcesPath = app.isPackaged
  ? path.join(process.resourcesPath, 'extraResources')
  : path.join(process.env!.PWD!, 'extraResources');

const zintPath = path.join(process.env!.HOME!, '.zint');

const webpackBasePath = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY.split(path.sep).slice(0, -2).join(path.sep);
const extraResourcesComponentPath = path.join(extraResourcesPath, 'components');

// console.log({ zintPath, isPackaged: app.isPackaged, webpackBasePath, extraResourcesComponentPath })

const config = new Store() as any; // typescript doesn't find the methods for Store

let usedBoundIds: Record<string, boolean> = {};

interface Bounds {
  boundsId: string;
  rect?: Electron.Rectangle;
};

function filterUnusableBounds(bounds?: Bounds | null): boolean {
  return !!bounds?.rect && bounds.rect.width > 300 && bounds.rect.height > 200;
}

function getBoundsFromStore(): Bounds[] {
  return (config.get('winBounds', []) as Bounds[]).filter(filterUnusableBounds);
}

function getFirstAvailableBoundsInner(): Bounds {
  const stack = getBoundsFromStore();
  for (const e of stack) {
    if (!usedBoundIds[e.boundsId]) {
      usedBoundIds[e.boundsId] = true;
      return e;
    }
  }
  const boundsId = uuidv4();
  usedBoundIds[boundsId] = true;
  return { boundsId };
}

function getFirstAvailableBounds(): Bounds {
  try {
    return getFirstAvailableBoundsInner();
  } catch (e) {
    config.set('winBounds', []);
    const boundsId = uuidv4();
    usedBoundIds = { [boundsId]: true };
    return { boundsId };
  }
}

function storeBounds(bounds: Bounds): void {
  let stack = getBoundsFromStore();
  const ix = stack.findIndex((o) => o.boundsId === bounds.boundsId);
  if (ix === -1) {
    stack.push(bounds);
  } else {
    stack[ix] = bounds;
  }

  if (stack.length > 10) {
    stack = stack.slice(0, 10);
  }

  config.set('winBounds', stack);
}

function getBoundsByIdInner(boundsId: string): Bounds {
  let stack = config.get('winBounds', []) as Bounds[];
  const ix = stack.findIndex((o) => o.boundsId === boundsId);
  if (ix === -1) {
    const { x, y, width, height } =
      (stack.length > 0 && stack[stack.length - 1].rect)
        ? stack[stack.length - 1].rect!
        : { x: 100, y: 100, width: 800, height: 600 };
    const ret = { boundsId, rect: { x: x + 50, y: y + 20, width, height } };
    stack.push(ret);
    config.set('winBounds', stack);
    return ret;
  }

  return stack[ix];
}

function getBoundsById(boundsId: string): Bounds {
  try {
    return getBoundsByIdInner(boundsId);
  } catch (e) {
    config.set('winBounds', []);
    return { boundsId, rect: { x: 100, y: 100, width: 800, height: 600 } };
  }
}

function createWindow(): void {
  let mainWindow: BrowserWindow & { boundsId?: string };

  let opts: Electron.BrowserWindowConstructorOptions = {
    show: false,
    webPreferences: {
      contextIsolation: true,
      //enableRemoteModule: false,
      sandbox: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  };

  const { boundsId, ...rest } = getFirstAvailableBounds();
  Object.assign(opts, rest);

  mainWindow = new BrowserWindow(opts);

  mainWindow.boundsId = boundsId;

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, callback) => {
      if (!app.isPackaged && details.url.startsWith('http://localhost:')) callback({});
      else if (details.url.startsWith('http://localhost:32333/')) callback({});
      else {
        console.warn('refusing web request to', details.url);
        callback({ cancel: true });
      }
    }
  );

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  const sleep = (n: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, n);
    });
  };

  mainWindow.once('ready-to-show', async () => {
    const { boundsId, rect } = getBoundsById(mainWindow.boundsId!);
    if (rect) mainWindow.setBounds(rect);
    mainWindow.show();

  });

  mainWindow.on('close', () => {
    const rect = mainWindow.getBounds();
    usedBoundIds[mainWindow.boundsId!] = false;
    storeBounds({ boundsId: mainWindow.boundsId!, rect });
  });

  mainWindow.webContents.on('close' as any, () => {
    const rect = mainWindow.getBounds();
    usedBoundIds[mainWindow.boundsId!] = false;
    storeBounds({ boundsId: mainWindow.boundsId!, rect });
  });
}

const backendRequestNonce = uuidv4();

const sendBackendRequest = ({
  type,
  action,
  actionIfNoWindow,
}: {
  type: string;
  action: string;
  actionIfNoWindow: () => void;
}): void => {
  if (BrowserWindow.getAllWindows().length === 0) {
    actionIfNoWindow();
    return;
  } else {
    BrowserWindow.getFocusedWindow()?.webContents.send('backendRequest', {
      type,
      action,
      nonce: backendRequestNonce,
    });
  }
};

const menuActionEmitter = (
  action: string,
  actionIfNoWindow: string
): void => {
  if (action === 'createWindow') {
    createWindow();
  } else {
    const ifNoWindow = () => {
      if (actionIfNoWindow === 'createWindow') {
        createWindow();
      }
    };
    sendBackendRequest({ type: 'menuAction', action, actionIfNoWindow: ifNoWindow });
  }
};


/* this allows to start a react iframe from the backend code. 
 * originally intended for an autoupdate/install wizard, currently unused
 */
const componentRequestEmitter = (
  component: string,
  componentArgs: any,
  builtinArgs: any,
  webContents?: Electron.WebContents
): { controlPort: MessagePort; dataPort: MessagePort } | undefined => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.error('a Component request was emitted for', component, 'but no window is active');
    return;
  }

  const { port1: controlPortToWindow, port2: controlPort } = new MessageChannelMain();
  const { port1: dataPortToWindow, port2: dataPort } = new MessageChannelMain();

  if (!webContents) {
    webContents = (BrowserWindow.getFocusedWindow() ||
      BrowserWindow.getAllWindows()[0]).webContents;
  }

  webContents.postMessage('backendRequest', {
    type: 'component',
    action: { component, componentArgs, builtinArgs },
  }, [controlPortToWindow, dataPortToWindow]);

  return { controlPort: controlPort as any, dataPort: dataPort as any };
};

app.whenReady()
  .then(() => {
    menu.setMenu(menuActionEmitter, app.isPackaged);
    createWindow();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    app.on('did-become-active', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

const shellCommandRunner = require('./shellCommandRunner');

ipcMain.on('startShell', (event, message) => {
  const [controlPort, dataPort] = event.ports;
  return shellCommandRunner.startShellInPty(message.options, controlPort, dataPort);
});

const dynamicComponentServer = require('./dynamicComponentServer');
const componentPath = path.join(zintPath, 'components');
dynamicComponentServer.start(componentPath, extraResourcesComponentPath, webpackBasePath);

/* code to request microphone permission
(probably) needed if an iframe needs the microphone 

if (process.platform === 'darwin') {
  (async () => {
    const status = await systemPreferences.askForMediaAccess('microphone')
    console.log('system prefs microphone permission granted', status)
  })()
}

*/