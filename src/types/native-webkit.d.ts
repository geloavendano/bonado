type BonadoNativeMessageHandler = {
  postMessage: (message: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        bonadoNativeActionButton?: BonadoNativeMessageHandler;
        bonadoNativeDashboardControls?: BonadoNativeMessageHandler;
        bonadoNativeNav?: BonadoNativeMessageHandler;
        bonadoNativeScreenBack?: BonadoNativeMessageHandler;
        bonadoNativeTheme?: BonadoNativeMessageHandler;
        bonadoNativeTopControls?: BonadoNativeMessageHandler;
      };
    };
  }
}

export {};
