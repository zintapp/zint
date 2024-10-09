
import { Buffer } from 'buffer';
import { ReactRenderParams, ReactBuiltinArgs } from './ComponentInterface'

type ReactCompoArgumentType = 'title'

export function parseReactBuiltinArguments_v0(data: string) : ReactRenderParams {
    const buff = Buffer.from(data, 'base64')
    const struff = buff.toString('utf-8')
    const parsed = JSON.parse(struff)

    const { command, ...builtins } = parsed

    let builtinArgs = {
        title: builtins.title
    }

    let componentName: any
    let componentArgs: any[] = []

    if (Array.isArray(command) && command.length > 0) {
        [componentName, ...componentArgs] = command
    }

    if (!componentName) {
        componentName = "internal/default/iframe"
        if(!builtinArgs.title) {
            builtinArgs.title = "iframe"
        }
    }

    let pipeUnit : ReactRenderParams = {
        type: 'react',
        component: componentName,
        componentArgs,
        builtinArgs
    }

    return pipeUnit

}
