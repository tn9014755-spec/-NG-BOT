// BC NGAY + BC FRESH entrypoint for the existing Render service.
// BC FRESH patch is loaded first so it can extend the existing LINE webhook.
require('./bc_fresh_bot.js');
require('./bc_server.js');
