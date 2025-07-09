/*
 Dynamic component server 
 we need that, because the module federation scripts are going to be added under the form <script src="http://localhost:32333/...." /> 
 and we can't let chromium load arbitrary files via file:/// protocol... (file:///etc/passwd, file:///dev/tcp etc...) */
 
const express = require('express');
const cors = require('cors');
const request = require('request');
const path = require('path')
const fs = require('fs/promises')

export function start(componentPath, internalComponentPath, webpackBasePath, port) {
    const dynamicComponentServer = express();

    dynamicComponentServer.use(cors())
    
    /***** ALERT - UGLY HACK ******
     * 
     * webpack's module federation emits remoteEntry.js files where the publicPath is hardcoded - ie the files can't be moved as
     *   their address is hardcoded
     * the component's sdk includes a hack that sets the public path to http://zint-component-server
     * we will replace this path by the dynamic component's URL. 
     * thanks for your attention **/
     dynamicComponentServer.get('/scopes/:scope/remoteEntry.js', async (req, res) => {
        console.log("request for remoteEntry for", req.params.scope, "path", req.path)
        try {
            var data = await fs.readFile(path.join(componentPath, req.params.scope, 'remoteEntry.js'), 'utf8')
            data = data.replace('http://zint-component-server', `http://localhost:${PORT}/scopes/${req.params.scope}/`)
            res.type('application/javascript')
            res.charset = 'utf-8'
            res.send(data)
        }
        catch (e) {
            console.error('Error!', e)
            res.status(500)
            res.send('Error !!' + e)
        }
    })
    dynamicComponentServer.get('/internal/:scope/remoteEntry.js', async (req, res) => {
        console.log("request for remoteEntry for internal/", req.params.scope, "path", req.path)
        try {
            var data = await fs.readFile(path.join(internalComponentPath, req.params.scope, 'remoteEntry.js'), 'utf8')
            data = data.replace('http://zint-component-server', `http://localhost:${PORT}/internal/${req.params.scope}/`)
            res.type('application/javascript')
            res.charset = 'utf-8'
            res.send(data)
        }
        catch (e) {
            console.error('Error!', e)
            res.status(500)
            res.send('Error !!' + e)
        }
    })
    /**** END UGLY HACK ****/


    dynamicComponentServer.use('/scopes', express.static(componentPath))
    dynamicComponentServer.use('/internal', express.static(internalComponentPath))
    dynamicComponentServer.use('/', express.static(webpackBasePath))

    dynamicComponentServer.listen(port, () => console.log(`Dynamic Component Server listening on port: ${port}`));

}
