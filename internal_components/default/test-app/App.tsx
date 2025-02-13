import React from "react";
import ReactDOM from "react-dom";
import Component from "../src/Component";
import { ReplaySubject } from "rxjs";
import binaryData from './testInputData.bin'

/* This is a mini react application which is only used for development
   and test purposes. It will not affect the exported zint component */
interface DataChunk {
      type: string
      data: Buffer
}

const subject = new ReplaySubject<DataChunk>();
subject.next({ type: "data", data: binaryData });
subject.complete();

const App = () => {
  const [isClosed, setClosed] = React.useState<boolean>(false)
  if (!isClosed)
     return <Component 
         componentName="Default"
         componentArgs={[]} 
         data$={subject.asObservable()}
         stdout={data => console.log(data)}
         closeStdout = { () => {} }
         close={ () => setClosed(true) } />
  else 
     return <h1>Component was closed!</h1>
};

ReactDOM.render(<App />, document.getElementById("app"));
