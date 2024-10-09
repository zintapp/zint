import React, { Suspense } from 'react'

/* delay promise function in order to check that things are correctly cached


function delayPromise(delay = 1000, ...log) {
    if(log) console.log(...log)
    return (obj) => new Promise( (resolve) => {
        setTimeout(() => {
            resolve(obj)
        }, delay)
    })
}
*/

async function loadModule(scope, module) {
    // Initializes the share scope. This fills it with known provided modules from this build and all remotes
    await __webpack_init_sharing__("default");
    const container = window[scope]; // or get the container somewhere else
    //console.log(`container = window[${scope}] = `, container)
    // Initialize the container, it may provide shared modules
    await container.init(__webpack_share_scopes__.default);
    const factory = await window[scope].get(module);
    //console.log('factory : ', factory)
    const Module = factory();
    return Module;
}
    
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {        // Update state so the next render will show the fallback UI.        
        return {hasError: true, error}
    }
    
    componentDidCatch(error, errorInfo) {        // You can also log the error to an error reporting service        
        this.setState({error, errorInfo});    
        console.error(this.props.component, 'failed to render. Error:', error.toString())
        console.error('errorInfo', errorInfo)
    }

    describeError(error) {
        if (error instanceof ScopeNotFound)
            return <div>Scope {error.scope} was not found.</div>
        if (error instanceof ScopeUnableToLoad)
            return <div>Scope {error.scope} was found but its remoteEntry could not be loaded.</div>
        if (error instanceof ModuleUnableToLoad)
            return <div>Scope {error.scope} loaded but module {error.module} unable to load.</div>
        if (error instanceof ModuleNotFoundInScope)
            return <div>Module {error.requestedModule} not found in scope {error.scope}. Available modules: {error.availableModules.map(o=>error.scope+'/'+o)}</div>
        if (error instanceof SpecifyModuleName)
            return <div>Scope {error.scope} contains several modules : {error.modules.map(o=>error.scope+'/'+o)}</div>
        return <div>{error.toString()}</div>
    }

    render() {
        if (this.state.hasError) {          
            return <div className="dynamicerrorcontainer">
                        <div>Error during '{this.props.component}' loading:<br/></div>
                        {this.state.error && this.describeError(this.state.error)}
                    </div>; 
            }
        return this.props.children; 
    }
}


let globalScopesConfig = { scopes: {}, internal: {}};

function getScopeConfigPromise(globalScope, scope) {
    if (!globalScopesConfig[globalScope][scope]) {
        globalScopesConfig[globalScope][scope] = { 
            status: 'pending',
            promise: fetch(buildScopesURL(globalScope, scope, 'component.config.json'))
            //.then(delayPromise(1000, 'loading component config'))
                .then(response => response.json())
                .then(config => { 
                    globalScopesConfig[globalScope][scope].config = config 
                    globalScopesConfig[globalScope][scope].status = 'ready'
                    return config })
                .catch(error => {
                    globalScopesConfig[globalScope][scope].error = error
                    globalScopesConfig[globalScope][scope].status = 'error'
                })
        }
    }
    return globalScopesConfig[globalScope][scope].promise
}

/* Suspense integration = 
    - success : return value
    - failure : throw value
    - pending : throw promise
    */
class ScopeNotFound extends Error {
    constructor(message, scope) {
        super(message);
        this.name = "ScopeNotFound";
        this.scope = scope
    }

}

const useScopeConfig = (globalScope, scope) => {
    if (!globalScopesConfig?.[globalScope]?.[scope]?.status || globalScopesConfig[globalScope][scope].status === 'pending') {
        throw getScopeConfigPromise(globalScope, scope)
    }
    if (globalScopesConfig[globalScope][scope].status === 'ready') {
        return globalScopesConfig[globalScope][scope].config
    }
    if (globalScopesConfig[globalScope][scope].status === 'error') {
        throw new ScopeNotFound(globalScopesConfig[globalScope][scope].error, scope)
    }
}


let globalRemoteEntryPromises = { scopes: {}, internal: {}};

function buildScopesURL(globalScope, scope, file) {
    return `http://localhost:32333/${globalScope}/${scope}/${file}`
}

function getRemoteEntryPromise(globalScope, scope) {
    if (!globalRemoteEntryPromises[globalScope][scope]) {
        const element = document.createElement("script");
        globalRemoteEntryPromises[globalScope][scope] = {
            status: 'pending',
            error: null,
            promise: new Promise( (resolve, reject) => {
        
                element.src = buildScopesURL(globalScope, scope, 'remoteEntry.js');
                element.type = "text/javascript";
                element.async = true;

                element.onload = () => {
                    globalRemoteEntryPromises[globalScope][scope].status = 'ready'
                    resolve({status: 'ready'});
                };

                element.onerror = (error) => {
                    console.error(`Dynamic Script Error: ${scope}`, error);
                    globalRemoteEntryPromises[globalScope][scope].status = 'failed'
                    globalRemoteEntryPromises[globalScope][scope].error = error
                    reject({status: 'failed', error});
                };

                document.head.appendChild(element);

            })/*.then(delayPromise(1000, 'loading remote url', url))*/,
            remove: () => {
                document.head.removeChild(element);
            }
        }
    }
    return globalRemoteEntryPromises[globalScope][scope].promise
}

class ScopeUnableToLoad extends Error {
    constructor(message, scope) {
        super(message);
        this.name = "ScopeUnableToLoad";
        this.scope = scope
    }
}

const useRemoteEntry = (globalScope, scope) => {
    if (!globalRemoteEntryPromises?.[globalScope]?.[scope] || globalRemoteEntryPromises[globalScope][scope].status === 'pending') {
        throw getRemoteEntryPromise(globalScope, scope)
    }
    if (globalRemoteEntryPromises[globalScope][scope].status === 'ready') {
        return true // no real data for the remote entry.
    }
    if (globalRemoteEntryPromises[globalScope][scope].status === 'error') {
        throw new ScopeUnableToLoad(globalRemoteEntryPromises[globalScope][scope], scope)
    }

}

let loadedModulesPromises = {}
const buildModuleKey = (scope, module)  => `@${scope}/${module}`

function getLoadedModulePromise(scope, module) {
    const key = buildModuleKey( scope, module)
    if (!(key in loadedModulesPromises)) {
        loadedModulesPromises[key] = {
            status: 'pending',
            promise: loadModule(scope, module) // we call the async function and get the promise.
                        //.then(delayPromise(1000, 'loaded module!'))
                        .then(Module => {
                            //console.log("module loaded !", Module)
                            loadedModulesPromises[key].Module = Module
                            loadedModulesPromises[key].status = 'ready'
                            loadedModulesPromises[key].component = Module.default
                        }) 
                        .catch(error => {
                            //console.error('error when calling loadmodule', error)
                            loadedModulesPromises[key].status = 'error'
                            loadedModulesPromises[key].error = error
                        })
        }
    }
    return loadedModulesPromises[key].promise;
}

class ModuleUnableToLoad extends Error {
    constructor(message, scope, module) {
        super(message);
        this.name = "ModuleUnableToLoad";
        this.scope = scope
        this.module = module
    }
}

const useLoadedModule = ( scope, module) => {
    const key = buildModuleKey( scope, module)

    if (!(key in loadedModulesPromises) || loadedModulesPromises[key].status === 'pending') {
        throw getLoadedModulePromise(scope, module)
    }
    if (loadedModulesPromises[key].status === 'ready') {
        return loadedModulesPromises[key]
    }
    if (loadedModulesPromises[key].status === 'error') {
        throw new ModuleUnableToLoad(loadedModulesPromises[key].error, scope, module)
    }
}

class SpecifyModuleName extends Error {
    constructor(message, scope, modules) {
        super(message);
        this.name = "SpecifyModuleName";
        this.scope = scope
        this.module = modules
    }
}

class ModuleNotFoundInScope extends Error {
    constructor(message, scope, requestedModule, availableModules) {
        super(message);
        this.name = "ModuleNotFoundInScope";
        this.scope = scope
        this.requestedModule = requestedModule
        this.availableModules = availableModules
    }
}

const LoadDynamicComponent = (props) => {
    const {component, componentLoader, ...rest} = props
    const splits = component.split('/')
    let [globalScope, scope, module] = ['scopes']
    if(splits.length < 3) {
        [scope, module] = splits
    }
    else if(splits.length == 3) {
        [globalScope, scope, module] = splits
    }

    //console.log('asked for scope', scope, 'module', module)
    const config = useScopeConfig(globalScope, scope)
    const _ = useRemoteEntry(globalScope, scope)
    
    const { scope: scopeFromConfig, modules } = config
    console.log('scope from config :', scopeFromConfig, 'moduleS', modules)
    if (!module) {
        if (modules.length != 1) {
            throw new SpecifyModuleName("Only scope specified but several modules in it", scope, modules)
        }
        module = modules[0]
    }
    else if (!(modules.includes(module))) {
        throw new ModuleNotFoundInScope("Module not found", scope, module, modules)
    }

    console.log('loading component from scope', scopeFromConfig, 'module', module)
    console.log('window.',scopeFromConfig, ":", window[scopeFromConfig])
    const loadedModule = useLoadedModule(scopeFromConfig, module)
    
    if(componentLoader) {
        return componentLoader(loadedModule.Module, rest)
    }
    
    const Component = loadedModule.component
    return <Component {...rest} />
}

export const DynamicComponent = React.memo((props) => {
    return  <ErrorBoundary component={props.component}>
                <Suspense fallback={`Loading component ${props.component}`}>
                    <LoadDynamicComponent {...props} />
                </Suspense>
            </ErrorBoundary>
})
