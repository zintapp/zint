import React from 'react';
import ReactDOM from 'react-dom';
import { createObservablesFromDataPort } from './dynamicComponentRun'
import { DynamicComponent } from './DynamicComponent'
import { Buffer } from 'buffer'
import { emulateTab } from 'emulate-tab';


class App extends React.Component {

    constructor(props) {
        super(props)
        this.state = {status:'waiting_config'}
    }

    componentDidMount() {
        this.props.promise.then( ({ component, componentArgs, controlPort, dataPort }) => {
            const { data$, returnChannel } = createObservablesFromDataPort(dataPort)
            controlPort.onmessage = this.onControlPortMessageReceived.bind(this)
            this.setState({ status:'config_received', component, componentArgs, controlPort, dataPort, data$, returnChannel })

            setTimeout(() => { try { emulateTab() } catch {} }, 100)
        })
    }

    dropIframe() {
        this.state.controlPort.postMessage({type: 'delete_iframe'})
        this.state.dataPort.postMessage({type: 'delete_iframe'})
    }

    onControlPortMessageReceived(e) {
        if (e.data.type === 'destroy') {
            //console.log('destroying iframe !')
            this.state.controlPort.close()
        }
    }

    displayHelper(loadedModule, props) {
        console.log(loadedModule)
        if(loadedModule.HelpComponent) {
            const Help = loadedModule.HelpComponent
            return <Help {...props} />
        }
        else if(loadedModule.getHelpText) {
            return <div className='helpcontainer'>
                <pre style={{textAlign: 'left'}}>
                    {loadedModule.getHelpText()}
                </pre>
            </div>
        }
        else {
            return <div className='dynamicerrorcontainer'>
                <div>Error: component '{this.state.component}' does not seem to have any help text.</div>
            </div>
        }
    }

    stdout(data, encoding) {
        if( (typeof(data) === 'string')) {
            const encoding2 = encoding | 'utf-8'
            const encoded = Buffer.from(data, encoding2)
            this.state.returnChannel.next({ type: 'stdin', data: { chunk: encoded } })
        }
        else {
            this.state.returnChannel.next({ type: 'stdin', data: { chunk: data } })
        }
    }
    
    render() {
        if (this.state.status === 'waiting_config')
            return <div>waiting config from main browser!</div>
        const props = {
            component: this.state.component,
            componentArgs: this.state.componentArgs,
            data$: this.state.data$,
            returnChannel: this.state.returnChannel,
            stdout: this.stdout.bind(this),
            dropIframe: this.dropIframe.bind(this)
        }
        if (this.state.componentArgs.length >= 1) {
            this.state.componentArgs.forEach( (o) => {
                if (['--help', '-h'].includes(o)) {
                    props.componentLoader = this.displayHelper.bind(this)
                }
            })
        }
        return <DynamicComponent {...props} />
    }
}

let resolveInitialPromise;
const promise = new Promise((resolve) => {
    resolveInitialPromise = resolve
})

let controlPort
let dataPort

function onMessage(e) {
    //console.log('iframe received message!', e)
    if (e.data.type === 'initialComponentConfig') {
        controlPort = e.ports[0]
        dataPort = e.ports[1]
        resolveInitialPromise({...e.data, controlPort, dataPort})
    }
}

//console.log('iframe register for message listening !')
window.addEventListener('message', onMessage);

window.addEventListener('pagehide', () => {
    //console.log('cleanup iframe !')
    //console.log('controlPort on message', controlPort.onmessage)
    controlPort.onmessage = null
   // console.log('controlPort on message', controlPort.onmessage)
    controlPort.onmessageerror = null
    dataPort.onmessage = null 
    dataPort.onmessageerror = null 
    controlPort.close()
    dataPort.close()
    controlPort = null
    dataPort = null
})

ReactDOM.render(
    <React.StrictMode>
        <App promise={promise} />
    </React.StrictMode>,
    document.getElementById('app')
);
  
  