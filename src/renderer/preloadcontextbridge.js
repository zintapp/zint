const {
    contextBridge,
    ipcRenderer
} = require("electron");

for (const type of ['chrome', 'node', 'electron']) {
    console.log(type, process.versions[type])
  }

let isReadyForPostMessage = false
let postMessageBacklog = []
ipcRenderer.on('backendRequest', (event, data) => {
    if(!isReadyForPostMessage) {
        postMessageBacklog.push({message: {type: 'backendRequest', data}, ports:event.ports})
    }
    else {
      window.postMessage({type: 'backendRequest', data}, '*', event.ports)
    }
})
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        invoke: (channel, ...args) => {
            // whitelist channels
            let validChannels = ["backendRequestHandle"];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
        },
        startShell: ({options, nonce}) => {
            const channel = 'startShell';
            const { port1: dataPortToTransferToNode, port2: dataPortToTransferToFrame } = new MessageChannel() 
            const { port1: ctrlPortToTransferToNode, port2: ctrlPortToTransferToFrame } = new MessageChannel() 

            ipcRenderer.postMessage(channel, {options}, [ctrlPortToTransferToNode, dataPortToTransferToNode]);
            
            console.log('started Shell!')
            window.postMessage({type: 'startedShell', nonce}, '*', [ctrlPortToTransferToFrame, dataPortToTransferToFrame])
        },
        readyForPostMessage: () => {
            isReadyForPostMessage = true
            postMessageBacklog.forEach(({ message, ports }) => {
                window.postMessage(message, '*', ports)
            })
            postMessageBacklog = []
        }
    }
);
