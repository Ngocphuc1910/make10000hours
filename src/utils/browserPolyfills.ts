// Browser polyfills for Node.js APIs that some libraries expect

// Polyfill for process object that googleapis needs
if (typeof window !== 'undefined' && !window.process) {
  (window as any).process = {
    env: {},
    version: '',
    platform: 'browser',
    nextTick: (callback: Function) => setTimeout(callback, 0),
    cwd: () => '/',
    argv: [],
    stderr: { write: console.error },
    stdout: { write: console.log },
  };
}

// Polyfill for global if needed
if (typeof window !== 'undefined' && !window.global) {
  (window as any).global = window;
}

export {};