import React from 'react';
import { createObservablesFromDataPort, StdioCommData, CmdReturnData } from './dynamicComponentRun'
import { DynamicComponent } from './DynamicComponent'
import { Observable, Subject } from 'rxjs'


interface DynamicComponentTrustedProps {
    dataPort: MessagePort
    component: string,
    componentArgs: string[]
}

interface DynamicComponentTrustedState {
    dropped: boolean
}

export class DynamicComponentTrusted extends React.Component<DynamicComponentTrustedProps, DynamicComponentTrustedState> {
    data$: Observable<StdioCommData> | null;
    returnChannel: Subject<CmdReturnData> | null;

    constructor(props: DynamicComponentTrustedProps) {
        super(props)
        this.state = {dropped: false}
        const { data$, returnChannel } = createObservablesFromDataPort(props.dataPort)
        this.data$ = data$
        this.returnChannel = returnChannel
    }

    dropIframe() {
        this.setState({ dropped: true })
    }

    componentWillUnmount() {
        this.data$ = null
        this.returnChannel = null
    }
    
    render() {
        if(this.state.dropped) {
            return null;
        }
        return <DynamicComponent 
        //@ts-ignore
                        component={this.props.component}
                        componentArgs={this.props.componentArgs}
                        data$={this.data$}
                        returnChannel={this.returnChannel} 
                        resizeHeight={()=>{}} 
                        dropIframe={this.dropIframe.bind(this)} />
    }
}
