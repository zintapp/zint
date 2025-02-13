
import React from "react";
import { Buffer } from 'buffer';
import { Observable } from "rxjs";
import { filter, reduce, pluck, map } from "rxjs/operators"
import {fileTypeFromBuffer, FileTypeResult} from 'file-type';

import classNames from "classnames";

import darkreaderjs from './darkreaderjs.bin'

import { waitForAllData } from "@zintapp/utils"

import './styles.css'

const mimeTypesWhiteBackground = []

interface StdoutChunk {
    type: 'stdout'
    data: Buffer
}

interface CompoProps {
    componentArgs: string[]
    data$: Observable<StdoutChunk>
}

interface State {
    data: Buffer
    url?: string
    mime?: string
    loaded: boolean
}


const attemptToFindTypeHacks = (data: Buffer): string | undefined => {
    const rexByType = [
        {type:'text/html', rexes:[
            /<doctype\s+<!doctype\s+html/,
            /<html>/,
            /<body>/
        ]}
    ]
    const beginning = data.toString(undefined,0,2000).toLowerCase()

    for (const rexgroup of rexByType) {
        const {type, rexes} = rexgroup
        for (const rex of rexes) {
            if (beginning.match(rex)) {
                return type
            }
        }
    }
}

const Component = (props: CompoProps) => {
    
    const ref = React.useRef<HTMLIFrameElement>(null)
    const [state, setState] = React.useState<State>({data: Buffer.alloc(0), loaded:false})
    const receivedData = async (data: Buffer) => {
        const type = await fileTypeFromBuffer(data)
        let mime = type? type.mime : attemptToFindTypeHacks(data)
        console.log('detected mime :', mime)
        const blob = mime ? new Blob([data], {type: mime} )
                          : new Blob([data])
        const url = URL.createObjectURL(blob)
        setState({data, url, mime, loaded: false})
    }

    React.useEffect( () => {
        const subscription = props.data$.pipe(
            // filter(chunk => chunk.type=='stdout'),
            pluck('data'),
            waitForAllData(),
        ).subscribe((data: Buffer) => receivedData(data))
        return () => subscription.unsubscribe()
    }, []);

    const onIframeLoad = () => {
        setState(st => ({...st, loaded: true}))
        if (!state.mime || state.mime.startsWith('text/')) {
            const dr = ref.current!.contentWindow!.document.createElement('script')
            let drtext = Buffer.from(darkreaderjs).toString()
            drtext += `

            DarkReader.enable({
                brightness: 100,
                contrast: 100,
                sepia: 0
            });
            
            `
            dr.innerHTML = drtext
            ref.current?.contentWindow!.document.body.appendChild(dr)
        }
    }

    if (!state.url) return null;
    return <iframe 
        ref={ref}
        className={classNames({
            'iframe': true,
        })}
        src={state.url} height="100%" width="100%" onLoad={onIframeLoad} 
    />
}
export default Component;