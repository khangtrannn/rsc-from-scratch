// Include every client boundary in the SSR bundle so a hand-written SSR
// manifest can point React at its Webpack module id.
import "./app/components/Counter.jsx";
