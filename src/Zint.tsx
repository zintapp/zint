import React, { ChangeEvent } from 'react'

import { DynamicComponentTrusted } from './DynamicComponentTrusted'
import { IframeDynamicComponent } from './DynamicComponentIframe'
import { v4 as uuidv4 } from 'uuid'
import { TerminalComponent } from './Xtermjs';

import './Zint.css'
import { BackendComponentInterface, CreateComponentFunctionParameters, ReactRenderParams, ReactComponentInstance, XtermComponentInterface, XtermComponentInstance } from './ComponentInterface';

type TabType = 'terminal' | 'dynamic'

interface TabBasePropsType {
    type: TabType
    title?: string
}

export interface DynamicComponentTabBaseProps extends TabBasePropsType {
    type: 'dynamic'
    renderComponentProps: ReactRenderParams
    trusted: boolean
    controlPort: MessagePort
    dataPort: MessagePort
    nonce: string
    /*status$: Observable<CmdStatusData>
    stdio$: Observable<StdioCommData>
    returnChannel: Subject<CmdReturnData>
    closeChannel: () => void*/
}


export interface TerminalTabProps extends TabBasePropsType {
    type: 'terminal'
    dataPort: MessagePort,
    controlPort: MessagePort, 
    nonce: string,
}

type TabBaseProps = TerminalTabProps | DynamicComponentTabBaseProps

type TabProps = TabBaseProps & {
    closeTab: () => void
    active: boolean
}

interface BufferOutData {
    type: 'Buffer'
    data: Buffer
}

export type OutData = BufferOutData

class RunningTab extends React.PureComponent<TabProps> {
    render() {

        if(this.props.type === 'dynamic') {
            const renderComponentProps = this.props.renderComponentProps

            if (this.props.trusted) {
                return <DynamicComponentTrusted
                        //active={this.props.active}
                        dataPort={this.props.dataPort}
                        component={renderComponentProps.component}
                        componentArgs={renderComponentProps.componentArgs}
                    />
            }
            else {
                return <IframeDynamicComponent
                        //active={this.props.active}
                        dataPort={this.props.dataPort}
                        component={renderComponentProps.component}
                        componentArgs={renderComponentProps.componentArgs}
                    />
            }
        }
        else {
            return <TerminalComponent 
                controlPort={this.props.controlPort}
                dataPort={this.props.dataPort}
                closeTab={this.props.closeTab}
                nonce={this.props.nonce}
                active={this.props.active}
            />
        }
    }
}

interface MessagePortByNoncePromiseDict {
    [uuid: string]: (ports: readonly MessagePort[]) => void
}

const messagePortByNoncePromises: MessagePortByNoncePromiseDict = {}

let overloadedOnMessage = false

function overloadOnMessage(backendRequestCallback: (params: BackendRequest)=>void) {
    if (overloadedOnMessage) return;
    const previousOnMessage = window.onmessage?.bind(window)
    window.onmessage = (e:MessageEvent) => {
        console.log("received a messageEvent on global window", e)
        if (e?.data?.type === 'startedShell')
        {
            const promiseResolve = messagePortByNoncePromises[e.data.nonce]
            if(promiseResolve) {
                delete messagePortByNoncePromises[e.data.nonce]
                promiseResolve(e.ports)
            }
            else {
                console.log("Nonce doesn't exist in promiseResolve table... ??!")
                console.log("event", e)
                console.log("promise table", messagePortByNoncePromises)
                throw new Error("received a port for a nonce that doesn't exist in the promise table. ???")
            }
        }
        else if(e?.data?.type === 'backendRequest') {
            const data = {...e.data}
            if(e.ports) {
                data.ports = {controlPort: e.ports[0], dataPort: e.ports[1]}
            }
            backendRequestCallback(data)
        }
        else if (previousOnMessage) {
            return previousOnMessage(e)
        }
    }
    overloadedOnMessage = true;
}

function registerNoncePromise(nonce: string) {
    return new Promise<readonly MessagePort[]>((resolve) => {
        messagePortByNoncePromises[nonce] = resolve
    })
}


async function startTerminal(openTab: TabOpenFunction) {
    
    
    const nonce = uuidv4()

    const messagePortPromise = registerNoncePromise(nonce)

    const messageToNode = { nonce }
    //console.log('about to call startShell with message', messageToNode)


    window.api.startShell(messageToNode)
    
    const [ controlPort, dataPort ] = await messagePortPromise;
    
  
    let props: TerminalTabProps = {
        type: 'terminal',
        title: 'Terminal',
        controlPort,
        dataPort,
        nonce,

    };
    
    openTab(props)

}



function createComponentTab({params, controlPort, dataPort} : CreateComponentFunctionParameters, openTab: TabOpenFunction) {
    console.log('Creating component', params)
    const nonce = uuidv4()

    let dataPortToTransferToXterm: MessagePort | undefined
    let ctrlPortToTransferToXterm: MessagePort | undefined
    if (!controlPort){
        const { port1: ctrlPort1, port2: ctrlPortToTransferToFrame } = new MessageChannel() 
        controlPort = ctrlPortToTransferToFrame
        ctrlPortToTransferToXterm = ctrlPort1
    }
    if (!dataPort) {
        const { port1: dataPort1, port2: dataPortToTransferToFrame } = new MessageChannel() 
        dataPort = dataPortToTransferToFrame
        dataPortToTransferToXterm = dataPort1
    }

    const props: DynamicComponentTabBaseProps = {
        type: 'dynamic',
        dataPort,
        controlPort,
        nonce,
        trusted: false,
        renderComponentProps: params
    }

    props.title = props.renderComponentProps.builtinArgs.title || props.renderComponentProps.component

    openTab(props)

    return {nonce, dataPort: dataPortToTransferToXterm, controlPort: ctrlPortToTransferToXterm}
}

export type TabOpenFunction = (props: TabBaseProps) => void

interface TabHeaderEditBoxProps {
    value?: string
    onSubmit(value?: string): void,
}

function TabHeaderEditBox(props: TabHeaderEditBoxProps) {
    const [value, setValue] = React.useState(props.value);
    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
    };
    return (
      <form onSubmit={(e) => { props.onSubmit(value); e.preventDefault() }}>
        <input value={value} onChange={onChange} />
      </form>
    );

}

type TabHeaderProps = TabProps & { 
    setActive(): void 
}




function TabHeader(props: TabHeaderProps) {

    const [title, setTitle] = React.useState(props.title)
    const [isBeingRenamed, setBeingRenamed] = React.useState(false)

    if(props.active) {
        if (isBeingRenamed) {
            return <li className="nav active"><TabHeaderEditBox value={title} onSubmit={(newTitle) => {setBeingRenamed(false); setTitle(newTitle)}}/></li>
        }
        return <li className="nav active"><a className="nav" onClick={() => {setBeingRenamed(true);}} >{title}</a></li>
    }
    else {
        return <li className="nav"><a className="nav" onClick={props.setActive} >{title}</a></li>

    }

}

interface ZintProps {}
interface ZintState {
    runningTabs: TabBaseProps[]
    activeTabStack: string[]
    counter: number
}

interface MenuActionDict {
    [action: string] : () => void
}

export class Zint extends React.Component<ZintProps,ZintState> {
    
    constructor(props: ZintProps) {
        super(props)
        this.state = {
            runningTabs: [],
            activeTabStack: [],
            counter: 0
        }
        this.processMenuAction = this.processMenuAction.bind(this)
        this.processBackendRequest = this.processBackendRequest.bind(this)
        this.openTab = this.openTab.bind(this) 
    }

    componentDidMount() {
        ReactComponentInstance.registerManageComponentFunction(params => createComponentTab(params, this.openTab), this.closeTabByNonce.bind(this))
        overloadOnMessage(this.processBackendRequest)
        startTerminal(this.openTab)
        window.api.readyForPostMessage()
    }

    processBackendRequest(backendRequest: BackendRequest) {
        console.log('processing Backend Request', backendRequest)
        const { data: {type, action}, ports } = backendRequest
        switch(type) {
            case 'menuAction':
                this.processMenuAction(action)
                break;
            case 'component':
                BackendComponentInterface.processBackendRequest(action, ports!)
                break
            default:
                console.error('unknown backend request type', backendRequest.type)
        }
    }

    get activeTab() {
        return this.state.activeTabStack[0]
    }

    setActiveTabInState(state: ZintState, nonce:string): ZintState {
        
        const stack = state.activeTabStack
        const curIndex = stack.findIndex(o => (o === nonce))
        if (curIndex === -1) {
            return {...state, 
                activeTabStack: [nonce, ...stack] }
        }
        return {...state, 
            activeTabStack: [ nonce, ...stack.slice(0, curIndex), ...stack.slice(curIndex+1) ] }
    }

    setActiveTab(nonce: string) {
        this.setState( state => this.setActiveTabInState(state, nonce))
    }

    popActiveTab(state: ZintState): string[] {
        if(state.activeTabStack.length > 1) {
            return state.activeTabStack.slice(1)
        }
        else {
            return [ state.runningTabs?.[0].nonce ] 
        }
    }
    
    openTab(tab: TabBaseProps) {
        this.setState(state => ({
            runningTabs: [ ...state.runningTabs, tab], 
            activeTabStack: [ tab.nonce, ...state.activeTabStack] }))
    }

    increaseTabIndex(inc: number) {
        this.setState( state => {
            const curIndex = state.runningTabs.findIndex(o => (o.nonce == state.activeTabStack[0]))
            if (curIndex === -1) return state
            const numTabs = state.runningTabs.length
            const newIndex = (numTabs + curIndex + inc) % numTabs
            return this.setActiveTabInState(state, state.runningTabs[newIndex].nonce)
        })
    }

    getTabPosInStack(nonce: string) {
        return this.state.activeTabStack.findIndex(o => o === nonce)
    }

    processMenuAction(action: string) {

        const actions: MenuActionDict = {
            'closeTab': this.closeActiveTab.bind(this),
            'leftTab': () => { this.increaseTabIndex( -1 ) },
            'rightTab': () => { this.increaseTabIndex( +1 ) },
            'newTerminal': () => { startTerminal(this.openTab) }
        }
        if (actions[action]) {
            //console.log('Zint : processing action', action)
            actions[action]()
        } 
        else {
            console.log('unknown action', action, 'requested by menu')
        }
    }
    
    removeTabByNonce(tabs: TabBaseProps[], nonce: string ) {
        ReactComponentInstance.notifyCloseTab(nonce)
        const index = tabs.findIndex(o => (o.nonce == nonce))
        if (index === -1 ) {
            return tabs
        }
        return [ ...tabs.slice(0, index), ...tabs.slice(index+1, undefined) ]
    }

    closeActiveTab() {
        this.setState(state => ({
            runningTabs: this.removeTabByNonce(state.runningTabs, state.activeTabStack[0]),
            activeTabStack: this.popActiveTab(state)
        }))
    }

    buildTabTitle(o: TabBaseProps) {
        var title = o.type === 'terminal' ? 'Terminal' : o.renderComponentProps.component
        //title += ' ' + this.getTabPosInStack(o.nonce)
        return title
    }
    
    closeTabByNonce(nonce: string) {
        this.setState(state => ({
                runningTabs: this.removeTabByNonce(state.runningTabs, nonce),
                activeTabStack: nonce === state.activeTabStack[0] ? this.popActiveTab(state) : state.activeTabStack
            })    
        )
    }

    componentDidUpdate() {
        if(this.state.runningTabs.length === 0) {
            window.close()
        }
    }

    render() {
        return (<div className="app">
                <ul className="nav">
                    {this.state.runningTabs.map( o => <TabHeader 
                        key={o.nonce} 
                        {...o} 
                        active={o.nonce == this.activeTab} 
                        closeTab={() => this.closeTabByNonce(o.nonce)} 
                        setActive={() => this.setActiveTab(o.nonce)} 
                    />)}
                </ul>
		<div className="tab-container">
                    {this.state.runningTabs.map( (o) => {
                        return <div key={o.nonce}  className={o.nonce == this.activeTab?'active-tab':'inactive-tab'} >
                            <RunningTab 
                                {...o} 
                                active={o.nonce == this.activeTab} 
                                closeTab={() => this.closeTabByNonce(o.nonce)} />
                        </div> 
                    })}
                </div>
            </div>);
    }
}
