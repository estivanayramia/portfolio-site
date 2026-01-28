// Deprecated shim.
// Consent + telemetry now live in the unified core inside site.js bundle.
(() => {
  try {
    console.info("[Diagnostics] error-reporting.js is deprecated. Use the unified telemetry core.");
  } catch {}
})();
    window.addEventListener('error', (e) => {
      const errorData = {
        type: 'javascript_error',
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack?.slice(0, 1000)
      };
      
      // Send to server
      sendErrorReport(errorData);
      
      // Send to debugger if open
      if (window.__debuggerAddEvent) {
        window.__debuggerAddEvent('error', { level: 'error', msg: `${e.message} at ${e.filename}:${e.lineno}` });
      }
    });
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      const errorData = {
        type: 'unhandled_rejection',
        reason: e.reason?.toString()?.slice(0, 500)
      };
      
      sendErrorReport(errorData);
      
      if (window.__debuggerAddEvent) {
        window.__debuggerAddEvent('error', { level: 'error', msg: `Unhandled rejection: ${e.reason}` });
      }
    });
    
    // Network errors (fetch wrapper)
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      return origFetch.apply(this, args).catch(err => {
        const errorData = {
          type: 'network_error',
          url: args[0],
          message: err.message
        };
        

