const pty = require('node-pty');
const path = require('path')

function startShellInPty(options, controlPort, dataPort) {


    const HIGH = 1 * 1024 * 1024;
    const LOW = 50 * 1024;

    let watermark = 0;
    let isPaused = false

    let env = Object.assign({}, process.env)
    const zintBinPath = path.join(env.HOME, ".zint", "bin")
    if(!env.PATH.split(":").includes(zintBinPath)) {
       env.PATH = `${env.PATH}:${zintBinPath}`
    }
    var ptyProcess = pty.spawn(process.env.SHELL, ['--login'], {
        name: 'xterm-color',
        cols: 150,
        rows: 40,
        cwd: process.env.HOME,
        env: {}
      });

    ptyProcess.onData(chunk => {
        watermark += chunk.length;
        dataPort.postMessage({type: 'stdout', data: chunk})
        if (watermark > HIGH) {
            //console.log('watermark is high, pausing')
            ptyProcess.pause();
            isPaused = true
        }
    });

    controlPort.on('message', ({data: {type, data}}) => {
        switch(type) {
            case 'closing':
                ptyProcess.kill()
                break
            default:
                console.error('unknown message received in messagePort, type=', type)
        }
    })

    dataPort.on('message', ({data: {type, data}}) => {
        //console.log('received input from renderer ! type', type, 'data', data)
        switch(type) {
            case 'watermark':
                bytes = data.bytes
                watermark = Math.max(0, watermark - data.bytes)
                if (watermark < LOW && isPaused) {
                    //console.log('watermark is low - resuming')
                    ptyProcess.resume()
                    isPaused = false
                }
                break;
            case 'resize':
                const { rows, cols } = data
                if(!rows || !cols) { 
                    break;
                }
                ptyProcess.resize(cols, rows)
                break;
            case 'stdin':
                ptyProcess.write(data)
                break;
            case 'binary':
                ptyProcess.write(Buffer.from(data, 'binary'))
                break;
            default:
                console.error('received unexpected message type on messagePort', type)
        }
    })

    ptyProcess.onExit(({exitCode, signal}) => {
        dataPort.postMessage({type: 'closed', data: {code: exitCode, signal}})
        controlPort.postMessage({type: 'closed', data: {code: exitCode, signal}})
        dataPort.close()
        controlPort.close()
    })

    dataPort.start()
    controlPort.postMessage({type: 'pid', data: {pid: ptyProcess.pid}})
    controlPort.start()

    return {pid: ptyProcess.pid}
}

module.exports.startShellInPty = startShellInPty