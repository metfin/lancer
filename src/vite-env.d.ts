/// <reference types="vite/client" />
/// <reference types="chrome" />

declare global {
  interface Window {
    chrome: typeof chrome;
  }
}

// Chrome extension API
declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (
        callback: (request: any, sender: any, sendResponse: any) => void
      ) => void;
    };
  };
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, any>>;
      set: (data: Record<string, any>) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
  };
};
