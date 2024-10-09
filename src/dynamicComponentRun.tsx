import { Observable, Subject } from "rxjs"
import { ReplayOnceSubject } from "./replayOnceSubject"

export interface StdioCommData {
    type: 'stdout' | 'stderr'
    data: Buffer
}

interface ErrorStatusData {
    type: 'error'
    data: any
}

interface ClosedStatusData {
    type: 'closed'
    data: {code?: number, signal?: NodeJS.Signals}
}

interface PidStatusData {
    type: 'pid'
    data: {pid: number}
}

export type CmdStatusData = ClosedStatusData | ErrorStatusData | PidStatusData

interface CmdWatermarkData {
    type: 'watermark'
    data: {bytes: number}
}

interface CmdStdinData {
    type: 'stdin'
    data: {chunk: Buffer}
}

export type CmdReturnData = CmdWatermarkData | CmdStdinData

export function createObservableFromControlPort(controlPort: MessagePort) {
    const subjectStatus = new ReplayOnceSubject<CmdStatusData>()
    
    const onmessage = ({data: {type, data}} : any) => {
        //console.log("Received a chunk on controlPort", type, 'data:', data)
        
        subjectStatus.next({type, data})
        
        if (type == 'closed') {
            subjectStatus.complete()
        }

    }

    const onmessageerror = (event: any) => {
        console.error("Received an error on messageport", event)   
    }

    controlPort.onmessage = ({type, data}) => onmessage({type, data})
    controlPort.onmessageerror = (err) => onmessageerror(err)
    controlPort.start()

    return { status$: subjectStatus.asObservable() }

}



export function createObservablesFromDataPort(messagePort: MessagePort) {
    const subjectStdio = new ReplayOnceSubject<StdioCommData>()
    const subjectReturnChannel = new Subject<CmdReturnData>()
        
    const onmessage = ({data: {type, data}} : any) => {
        //console.log("Received a chunk on dataport", type, 'data:', data)
        if (type === 'stdout') {
            //console.log('pushing data in stdio subject', type, data)
            subjectStdio.next({type, data})
        }
        if (type === 'eof') {
            subjectStdio.complete()
        }

    }
        
    const onmessageerror = (event: any) => {
        console.error("Received an error on messageport", event)   
    }
    messagePort.onmessage = ({type, data}) => onmessage({type, data})
    messagePort.onmessageerror = (err) => onmessageerror(err)
    messagePort.start()

    subjectReturnChannel.asObservable().subscribe(event => {
        messagePort.postMessage(event)
    })

    return {
        data$: subjectStdio.asObservable(),
        returnChannel: subjectReturnChannel
    }
}

