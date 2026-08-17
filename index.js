// BC NGAY + BC FRESH + POS automation entrypoint.
// Load FRESH first, then route fix, BC NGAY server, Excel worker, and POS exporter.
require('./bc_fresh_runtime.js');
require('./bc_fresh_order_fix.js');
require('./bc_server.js');
require('./bc_local_excel_worker.js');
require('./pos_excel_automation.js');
