// BC NGAY + BC FRESH entrypoint for the existing Render service.
// Load FRESH first, then install the route-order fix, then load BC NGAY.
require('./bc_fresh_runtime.js');
require('./bc_fresh_order_fix.js');
require('./bc_server.js');
require('./bc_local_excel_worker.js');
