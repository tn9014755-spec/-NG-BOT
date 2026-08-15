// Ensure BC FRESH middleware runs BEFORE the existing BC NGAY /webhook handler.
// The existing FRESH installer appends its handler after the first route handler.
// This small wrapper inserts a harmless gate first, so FRESH becomes first real handler.
const express = require('express');

if (!express.application.__bcFreshOrderFix) {
  const currentPost = express.application.post;
  express.application.post = function(route, ...handlers) {
    if (route === '/webhook' && handlers.length) {
      const gate = (req, res, next) => next();
      return currentPost.call(this, route, gate, ...handlers);
    }
    return currentPost.call(this, route, ...handlers);
  };
  express.application.__bcFreshOrderFix = true;
}
