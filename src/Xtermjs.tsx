import React from 'react';
import { Buffer } from 'buffer';
import { Terminal, IDisposable } from 'xterm'
import { FitAddon } from 'xterm-addon-fit';


import 'xterm/css/xterm.css'
import { XtermComponentInstance, XtermComponentInterface, XtermParams } from './ComponentInterface';

export interface TerminalProps {
    dataPort: MessagePort,
    controlPort: MessagePort, // will be used to spawn new messagePorts for other componetns
    nonce: string,
    active: boolean,
    closeTab(): void
}


const MAX_TERMINAL_ROWS = 40;


export class TerminalComponent extends React.PureComponent<TerminalProps> {
    terminal?: Terminal;
    xtermRef: React.RefObject<HTMLDivElement>;
    webglAddon?: never;
    fitAddon?: FitAddon;
    onRenderFit?: IDisposable
    writing: number;
    writtenChars: number;
    customParser: IDisposable;
    componentInstance: XtermComponentInstance

    constructor (props: TerminalProps) {
        super(props)
        this.xtermRef = React.createRef()

        this.terminal = new Terminal({ 
            windowsMode: false,
            cols: 60,
            rows: MAX_TERMINAL_ROWS
        })
        /*this.webglAddon = new WebglAddon()
        this.webglAddon.onContextLoss(e => {
            console.log('webgl addon context lost !')
            this.webglAddon!.dispose()
        })*/

        this.fitAddon = new FitAddon()


        this.customParser = this.terminal!.parser.registerDcsHandler({prefix: '?', final: 'z'}, 
            this.handleEscape.bind(this))

        this.writing = 0
        this.writtenChars = 0
        this.state = { terminal: this.terminal }

        const params: XtermParams = {
            protocolVersion: 0,
            protocolMinorVersion: 1,
            protocolMinorSubversion: 1,
            type: 'xterm',
            returnChannel: this.handleReturnData,
            closeChannel: () => { console.log("closeChannel called") /* this.handleReturnData(Buffer.from('\x04', 'ascii')) */ }
        }
        this.componentInstance = new XtermComponentInstance(params, this.handleReturnData.bind(this))
        this.componentInstance.create()
        
    }

    setupControlPort() {
        const onmessage = ({data: {type, data}} : any) => {
            if (type === 'closed') {
                this.props.closeTab()
            }
    
        }        
        const onmessageerror = (event: any) => {
            console.error("Received an error on controlPort", event)   
        }
        this.props.controlPort.onmessage = ({type, data}) => onmessage({type, data})
        this.props.controlPort.onmessageerror = (err) => onmessageerror(err)
        this.props.controlPort.start()
    }

    handleEscape(data: string, params: any): boolean {
        //console.log("received custom payload. params", params, "data", data)
        XtermComponentInterface.handleXtermPayload(data, params, this.componentInstance!)
        // return false tells xtermjs that no further processing is needed on this data.
        return false
    }

    handleReturnData(data: Buffer) {
        console.log("sending to terminal:", data)
        this.sendToPty({type: 'stdin', data})

    }

    sendToPty(event: any) {
        this.props.dataPort.postMessage(event)
    }

    setupDataPort() {
        const onmessage = ({data: {type, data}} : any) => {
            if (type === 'stdout') {
                this.writing += 1
                this.terminal!.write(data, () => {
                    this.writtenChars += data.length
                    if (this.writtenChars > 50000) {
                        this.sendToPty({ type: 'watermark', data: {bytes: this.writtenChars} })
                        this.writtenChars = 0;
                    }
                    this.writing -= 1
                })
            }
        }

        const onmessageerror = (event: any) => {
            console.error("Received an error on dataPort", event)   
        }
        this.props.dataPort.onmessage = ({type, data}) => onmessage({type, data})
        this.props.dataPort.onmessageerror = (err) => onmessageerror(err)
        this.props.dataPort.start()
    }
    
    componentDidMount() {
        console.log('xterm componentDidMount')
        this.setupControlPort()
        this.setupDataPort()

        if(this.xtermRef.current) {
            this.terminal!.loadAddon(this.fitAddon!)
            this.terminal!.open(this.xtermRef.current)

            //console.log('calling fit. window.innerHeight', window.innerHeight, 'window.innerWidth', window.innerWidth)
            this.onRenderFit = this.terminal!.onRender(() => {
                this.fitAddon!.fit();
                this.onRenderFit?.dispose()
            })

            this.terminal!.onResize((data) => {
                this.sendToPty({
                    type: 'resize',
                    data
                })
            })
            
            window.addEventListener('resize', () => {
                //console.log('resize!')
                this.fitAddon?.fit()
            })

            //this.terminal!.loadAddon(this.webglAddon!)

            this.terminal!.onData( (chunk) => {
                this.sendToPty({
                    type: 'stdin',
                    data: chunk
                })
            })

            this.terminal!.onBinary( (chunk) => {
                this.sendToPty({
                    type: 'binary',
                    data: Buffer.from(chunk, 'binary')
                })
            })
            
            this.terminal!.focus()
        }
    }

    componentDidUpdate(prevProps: TerminalProps) {
        if(!prevProps.active && this.props.active) {
            this.fitAddon?.fit()
            this.terminal?.focus()
            //TODO: better
            this.terminal?.scrollToBottom()
        }
    }

    componentWillUnmount() {
        //console.log('disposing everythin')
        this.props.controlPort.postMessage({type: 'closing'})
        this.customParser?.dispose()
        /*this.webglAddon?.dispose()
        delete this.webglAddon*/
        this.fitAddon?.dispose()
        delete this.fitAddon
        this.terminal?.dispose()
        delete this.terminal
    }

    render() {
        return <div style={{width: '100%', height:'100%', overflow:'hidden'}} ref={this.xtermRef} />
    }

}
