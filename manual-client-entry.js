export const clientModuleLoaders = {
  "./app/components/Counter.jsx#default": () =>
    import(
      /* webpackChunkName: "client-app-components-Counter" */
      "./app/components/Counter.jsx"
    ),
};
