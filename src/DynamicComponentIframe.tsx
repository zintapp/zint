import React from 'react'


/**** 
 * status = 
 * not_loaded : waiting for iframe to load
 * loaded : sending control messageport, waiting for ack on messagePort (?)
 * control_port : control messageport received, sending data messagePort from process
 * functional : all is running
 */

interface DynamicComponentIframeProps {
    dataPort: MessagePort
    component: string,
    componentArgs: string[]
}

interface DynamicComponentIframeState {
    status: 'iframe_loading' | 'pending_data' | 'loading_component' | 'loaded' | 'deleted'
}

interface DeleteIframeControlMessage {
    type: 'delete_iframe'
}


type DynCompIframeControlMessage = DeleteIframeControlMessage
    
export class IframeDynamicComponent extends React.PureComponent<DynamicComponentIframeProps, DynamicComponentIframeState> {
    iframeRef: React.RefObject<HTMLIFrameElement>
    controlPort?: MessagePort

    constructor(props: DynamicComponentIframeProps) {
        super(props)
        this.state = { status: 'iframe_loading' }
        this.iframeRef = React.createRef()
    }

    onLoad() {
        this.setState({status: 'pending_data'})
        const { port1: local, port2: distant } = new MessageChannel();
        this.controlPort = local
        
        /* nb on Firefox the 2 messagePorts might arrive out of order : 
        https://bugzilla.mozilla.org/show_bug.cgi?id=1723029
        since we are developing for Electron, we don't really care. */

        const messageToSend = {
            type: "initialComponentConfig",
            component: this.props.component,
            componentArgs: this.props.componentArgs,
        }
        //console.log('about to post message with method',  this.iframeRef.current!.contentWindow!.postMessage)
        //console.log('message',  messageToSend)
        this.iframeRef.current!.contentWindow!.postMessage(messageToSend, '*', [distant, this.props.dataPort])
        this.iframeRef.current!.contentWindow?.focus()

        local.start()
        local.onmessage = this.onControlMessageReceived.bind(this)
    }

    postMessage(message: any) {
        this.controlPort!.postMessage(message)
    }

    onControlMessageReceived({ data }: {data: DynCompIframeControlMessage}) {
        //console.log("main browser received message from iframe :", data)
        if (data.type === 'delete_iframe') {
            //console.log("received a request to delete the iframe")
            this.setState({status: 'deleted'})
        }
        else {
            //console.log('received unexpected message of type', data.type)
        }
    }

    componentDidUpdate() {
        this.iframeRef?.current?.focus()
    }

    componentWillUnmount() {
        this.controlPort?.close()
        delete this.controlPort 
    }

    render() {
        if (this.state.status === 'deleted') return null;
        return <iframe style={{border: 'none',width: '100%', height:'100%'}} 
            src="http://localhost:32333/iframe" 
            ref={this.iframeRef} 
            onLoad={this.onLoad.bind(this)} 
            />
    }
}

    /*const [ dataMsgs, setDataMsgs ] = React.useState([])
    const addDataMsgs = (msg) => setDataMsgs(msgs => [...msgs, msg])

    React.useEffect( () => {
        localData.onmessage = ({ data }) => addDataMsgs(data)
        
        const interval = setInterval( () => { localData.postMessage("coucou" +Math.random() )}, 1000)

        return () => clearInterval(interval)
    }, [])*/
