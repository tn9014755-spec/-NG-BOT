// LINE BC image is handled exclusively by line_image_patch.js.
// Do not patch server_fixed.js here: multiple fetch wrappers caused duplicate/
// conflicting image messages. Keep this file as a compatibility no-op.
console.log('RUNTIME_LINE_IMAGE: delegated to line_image_patch.js (DT + FRESH)');
