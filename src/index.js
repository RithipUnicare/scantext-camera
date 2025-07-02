import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import Stock from "./Stock";
import reportWebVitals from "./reportWebVitals";
import MultiImage from "./MultiImage";
import SingleImage from "./SingleImage";
import FinalApp from "./FinalApp";
import TwiceCheck from "./TwiceCheck";
import CameraScan from "./Camera";
import CameraTest from "./CameraTest";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* <App /> */}
    {/* <Stock /> */}
    {/* <MultiImage /> */}
    {/* <SingleImage /> */}
    {/* <FinalApp /> */}
    {/* <TwiceCheck /> */}
    <CameraScan />
    {/* <CameraTest /> */}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
