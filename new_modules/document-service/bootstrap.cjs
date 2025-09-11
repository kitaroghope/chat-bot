// CommonJS wrapper that loads your ESM server
(async () => {
  try {
    await import('./server.js'); // server.js is ESM and will start the server on import
  } catch (err) {
    console.error('Failed to start ESM server:', err);
    process.exit(1);
  }
})();
