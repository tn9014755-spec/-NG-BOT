// BC NGAY + BC FRESH entrypoint for the existing Render service.
// BC FRESH runtime is loaded first so its webhook handler runs after express.raw().
require('./bc_fresh_runtime.js');
require('./bc_server.js');
