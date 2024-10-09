import { parseReactBuiltinArguments_v0 } from './commandParsing'

import { Buffer } from 'buffer'

export interface ComponentConnection {
    nonce: string
    controlPort: MessagePort
    dataPort: MessagePort
}
export interface CreateComponentFunctionReturn {
    nonce: string
    controlPort?: MessagePort,
    dataPort?: MessagePort
}

export interface CreateComponentFunctionParameters {
    params: ReactRenderParams
    controlPort?: MessagePort
    dataPort?: MessagePort
}
type CreateComponentFunction = (params: CreateComponentFunctionParameters) => CreateComponentFunctionReturn
type CloseComponentFunction = (nonce: string) => void;


export type RenderParamsType = 'xterm' | 'react' | 'backend'

export interface RenderParamsBase {
    type: RenderParamsType
}

export interface XtermParams extends RenderParamsBase{
    type: 'xterm'
    returnChannel: (data: Buffer) => void
    closeChannel: () => void
    protocolVersion: number
    protocolMinorVersion: number
    protocolMinorSubversion: number
}

export interface ReactRenderParams extends RenderParamsBase {
    type: 'react'
    component: string
    builtinArgs: ReactBuiltinArgs
    componentArgs: string[]
}

export interface BackendParams extends RenderParamsBase {
    type: 'backend'
}
export type RenderParams = ReactRenderParams | XtermParams | BackendParams

export interface ReactBuiltinArgs {
    title?: string,
}

abstract class ComponentInstance {
    params: RenderParams
    created: boolean
    closed: boolean
    sources: ComponentInstance[]
    destinations: ComponentInstance[]
    connection?: ComponentConnection

    constructor(params: RenderParams, source?: ComponentInstance) {
        this.params = params
        this.created = false
        this.sources = source && [source] || []
        this.closed = false
        this.destinations = []
    }

    abstract create(): void 

    markAsClosed() {}

    close() {
        // notify source if Any
        // notify all destinations
        this.closed = true
    }

}

export class BackendComponentInstance extends ComponentInstance {
    params: BackendParams

    constructor(params: BackendParams) {
        super(params)
        this.params = params
    }

    create() {}
}

export const backendComponentInstance = new BackendComponentInstance({ type: 'backend' })

export class XtermComponentInstance extends ComponentInstance {
    params: XtermParams
    writeToXterm: (data: Buffer) => void

    static isXterm(instance?: ComponentInstance): instance is XtermComponentInstance {
        return instance?.params.type === 'xterm'
    }

    constructor(params: XtermParams, writeToXterm: (data: Buffer) => void, source?: ComponentInstance) {
        super(params, source)
        this.params = params
        this.writeToXterm = writeToXterm
    }

    create() {
        this.created = true
    }

}

export class ReactComponentInstance extends ComponentInstance {
    params: ReactRenderParams

    private static _createReactComponent?: CreateComponentFunction
    private static _closeReactComponent?: CloseComponentFunction

    static registerManageComponentFunction(create: CreateComponentFunction, close: CloseComponentFunction) {
        if(this._createReactComponent && this._createReactComponent !== create) {
            console.warn('Trying to change component creation callback !', {old: this._createReactComponent, new_: create})
        }
        this._createReactComponent = create
        if(this._closeReactComponent && this._closeReactComponent !== close) {
            console.warn('Trying to change component creation callback !', {old: this._closeReactComponent, new_: close})
        }
        this._closeReactComponent = close
    }

    private static componentByNonce: { [nonce: string]: ReactComponentInstance } = {}

    static notifyCloseTab(nonce: string) {
        console.log('notifyiny closing tab', nonce)
        const instance = this.componentByNonce[nonce]
        if (!instance) return

        instance.close()
        delete this.componentByNonce[nonce]
    }

    constructor(params: ReactRenderParams, source?: ComponentInstance) {
        super(params, source)
        this.params = params

    }
    
    static getComponentByNonce(nonce: string) {
        return ReactComponentInstance.componentByNonce[nonce]
    }

    markAsClosed() {
        console.log("markAsClose called !")

        this.closed = true
    }

    closeFromComponent() {
        if(this.connection?.nonce) {
            ReactComponentInstance._closeReactComponent?.(this.connection.nonce)
         }
 
    }

    close() {
        console.log("close called !")
        if(this.closed) return

        this.closed = true

        this.sources.forEach(source => {
            if (XtermComponentInstance.isXterm(source)) {
                XtermComponentInterface.sendEOTtoXterm(source.writeToXterm)
            }
        })
    }

    create() {
        const created = ReactComponentInstance._createReactComponent?.({
            params: this.params, 
            dataPort: this.connection?.dataPort, 
            controlPort: this.connection?.controlPort})
        if (created) {
            this.created = true
            const {nonce, controlPort, dataPort} = created

            ReactComponentInstance.componentByNonce[nonce] = this

            const hasXtermSource = this.sources.some(source => XtermComponentInstance.isXterm(source))
            //TODO: move that logic to the sourceDestinationMapper
            if (dataPort) {
                dataPort.onmessage = (ev) => {
                    console.log("received msg on dataPort!")
                    console.log(ev)
                    if(ev.data.type === 'stdin') {
                        //TODO: sourceDestinationMapper.onDataPortMessage(this, ev)
                        this.sources.forEach(source => {
                            if (XtermComponentInstance.isXterm(source)) {
                                console.log("calling return channel!")
                                XtermComponentInterface.returnToXterm(source, ev.data.data.chunk) 
                            }
                        })
                    }
                    else if(ev.data.type === 'delete_iframe') {
                        console.log('closing component!')
                        this.closeFromComponent()
                    }
                }
            }
            this.connection = {
                nonce, 
                controlPort: controlPort!, 
                dataPort: dataPort!
            }
        }
    }
}

class SourceDestinationMapper {

    private static _instance: SourceDestinationMapper

    linksByID: { [id: number]: {source: ComponentInstance, destination: ComponentInstance, linkName?: string} }
    
    private constructor() {
        this.linksByID = {}
    }

    static get Instance() {
        if(!this._instance) {
            this._instance = new SourceDestinationMapper()
        }
        return this._instance;
    }


    add(key: number, source: ComponentInstance, destination: ComponentInstance) {

        this.linksByID[key] = {source, destination, linkName: 'main'}

    }

    addByDestinationNonce(key: number, source: ComponentInstance, destinationNonce: string, linkName?: string) {
        const destination = ReactComponentInstance.getComponentByNonce(destinationNonce)
        if (!destination) {
            console.error("Destination component not found !", destinationNonce)
            return
        }
        this.linksByID[key] = {source, destination, linkName}
    }

    /*addOld(key: number, source: RenderParams, destination: RenderParams) {
        this.createdComponents[key] = {source, destination}
        if(destination.type == 'react') {
            const created = this._createReactComponent?.({params: destination})
            if (created) {
                const {nonce, controlPort, dataPort} = created

                if (source.type === 'xterm' && dataPort) {
                    dataPort.onmessage = (ev) => {
                        console.log("received msg on dataPort!")
                        console.log(ev)
                        if(ev.data.type === 'stdin') {
                            console.log("calling return channel!")
                          source.returnChannel(ev.data.data.chunk)
                        }
                        else if(ev.data.type === 'closed') {
                          source.closeChannel()
                        }
                    }
                }
                this.createdComponents[key].destination.connection = {
                    nonce, 
                    controlPort: controlPort!, 
                    dataPort: dataPort!
                }
            }
        }
    }

    addWithPorts(key: number, source: RenderParams, destination: RenderParams, controlPort: MessagePort, dataPort: MessagePort) {
        this.createdComponents[key] = {source, destination}
        if(destination.type == 'react') {
            const created = this._createReactComponent?.({params: destination, controlPort, dataPort})!
            this.createdComponents[key].destConnection = {
                nonce: created.nonce,
                controlPort,
                dataPort
            }
        }
    }*/

    sourceEOF(key: number) {
        this.linksByID[key]?.destination.connection?.dataPort.postMessage({type: 'eof', data: {}})
    }

    closeSource(key: number) {
        this.linksByID[key]?.destination.connection?.dataPort.postMessage({type: 'closed', data: {}})
        this.linksByID[key]?.destination.connection?.dataPort.close()
        this.linksByID[key]?.destination.close()

    }

    markAsClosed(key: number) {
        // update status when zint has been closed from the terminal
        this.linksByID[key]?.destination.markAsClosed()
    }

    send(key: number, data: any) {
        this.linksByID[key]?.destination.connection?.dataPort.postMessage({type: 'stdout', data})
    }

}

export const sourceDestinationMapper = SourceDestinationMapper.Instance

export class BackendComponentInterface {
    static processBackendRequest(action: { component:string, builtinArgs: ReactBuiltinArgs, componentArgs: string[]}, ports: {controlPort: MessagePort, dataPort: MessagePort} ) {
        const key = Math.random()
        const destination: ReactRenderParams = {
            type: 'react',
            component: action.component,
            builtinArgs: action.builtinArgs,
            componentArgs: action.componentArgs, 
        }
        const {controlPort, dataPort} = ports

        const instance = new ReactComponentInstance(destination)
        instance.connection = {
            nonce: 'pending',
            controlPort,
            dataPort
        }
        instance.create()
        sourceDestinationMapper.add(key, backendComponentInstance, instance )
    }
}

export class XtermComponentInterface {

    static returnToXterm_V0(data: Buffer, writeToXterm: (data: Buffer) => void, params: Partial<XtermParams>) {
        console.log('returning to Xterm')
        const buf = Buffer.from(data)
        for(var i = 0; i < buf.length; i+=512) {
            const encoded = buf.slice(i, i+512).toString('base64')
            console.log("writing to Xterm : ", encoded)
            writeToXterm(Buffer.from(encoded+'\n', 'ascii'))
        }
    }

    static sendEOTtoXterm(writeToXterm: (data: Buffer) => void) {
        console.log("sending EOT to Xterm")
        writeToXterm(Buffer.from("\x04", 'ascii')); 
    }


    static returnToXterm(source: XtermComponentInstance, data: Buffer) {
        if(source.params.protocolVersion === 0) {
            XtermComponentInterface.returnToXterm_V0(data, source.writeToXterm, source.params)
        }
    }

    static handleXtermPayload(data: string, params: any, xTermInstance: XtermComponentInstance) {
        const protocolVersion = params[0];
        let protocolMinorVersion: number;
        let protocolMinorSubversion: number;
        let componentID: number;
        let payloadNumber: number;

        if(protocolVersion == 0) {
            protocolMinorVersion = params[1];
            protocolMinorSubversion = params[2];
            componentID = params[3];
            payloadNumber = params[4];
        }
        else {
            console.log("Unable to decode payload : params", params, "data", data)
            return
        }


        // si payload Number = 0 : create composant
        if(payloadNumber === 0) {

            const smpCommonParams = {type: "xterm" as "xterm", protocolVersion, protocolMinorVersion, protocolMinorSubversion}

            if(protocolVersion == 0) {
                //this.createdComponents[componentID] = this.props.createComponent(parseReactBuiltinArguments_v0(data))
                const reactParams = parseReactBuiltinArguments_v0(data)
                const reactInstance = new ReactComponentInstance(reactParams, xTermInstance)
                reactInstance.create()

                sourceDestinationMapper.add(componentID, xTermInstance, reactInstance )
            }
        }

        else if(payloadNumber == 1) { //EOF on stdin stream 
            //this.createdComponents?.[componentID]?.dataPort.postMessage({type: 'closed', data: {}})
            //this.createdComponents?.[componentID]?.dataPort.close()
            sourceDestinationMapper.sourceEOF(componentID)
        }

        else if(payloadNumber == 2) { 
            sourceDestinationMapper.markAsClosed(componentID)
        }

        else {
            //this.createdComponents?.[componentID]?.dataPort.postMessage({type: 'stdout', data: Buffer.from(data, 'base64')})
            sourceDestinationMapper.send(componentID, Buffer.from(data, 'base64'))
        }

    }
}

/*

destination.performRegistration(source) 
source.performRegistrations(destination)

registrationsByType["xterm-react"] = performRegistrationsXtermReact

check EventEmitter documentation

react.performRegistration() {
    if source == terminal {
        source.onEOF(destPort.send(eof machin))
    }
}



source.on('eof', () => {blablabla})
reactComponent.on('close', source.sendControlD)

*/
