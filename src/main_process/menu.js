const { app, Menu } = require('electron')



export function setMenu(menuActionEmitter, isPackaged) {
  const isMac = process.platform === 'darwin'
  
  const devViewSubMenu = [
    { role: 'reload' },
    { role: 'forceReload' },
  ]
  
  const prodViewSubMenu = [        
    { role: 'toggleDevTools' },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' }
  ]

  const viewSubMenu = isPackaged ? prodViewSubMenu : [ ...devViewSubMenu, ...prodViewSubMenu ]

  const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'Tabs',
      submenu: [
        { label: 'Close Tab', accelerator: 'CommandOrControl+W', click: () => menuActionEmitter('closeTab') },
        { type: 'separator' },
        { label: 'Go to right Tab', accelerator: 'CommandOrControl+]', click: () => menuActionEmitter('rightTab') },
        { label: 'Go to left Tab', accelerator: 'CommandOrControl+[', click: () => menuActionEmitter('leftTab') },
        { type: 'separator' },
        { label: 'New Window', accelerator: 'CommandOrControl+N', click: () => menuActionEmitter('createWindow') },
        { label: 'New Terminal Tab', accelerator: 'CommandOrControl+T', click: () => menuActionEmitter('newTerminal', 'createWindow') },
      ]
    },
    { 
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'paste'}
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: viewSubMenu
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Zint Website',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://zint.app')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}