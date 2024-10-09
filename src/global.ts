export {}


declare global {
  const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
  const MAIN_WINDOW_WEBPACK_ENTRY: string;
    interface BackendRequest {
      type: 'backendRequest'
      data: {
        type: 'menuAction' | 'component'
        nonce: string
        action: any
      }
      ports?: {
        controlPort: MessagePort
        dataPort: MessagePort
      }
    }
    interface Window {
        "api": {
          readyForPostMessage: () => void
          invoke:  (channel: string, ...args: any) => Promise<any>;
          startShell:  (msg: {options?: any, nonce: string}) => void;

          // https://github.com/frederiksen/angular-electron-boilerplate/blob/master/src/preload/preload.ts
          // https://www.electronjs.org/docs/all#ipcrenderersendtowebcontentsid-channel-args
        }
    }
}