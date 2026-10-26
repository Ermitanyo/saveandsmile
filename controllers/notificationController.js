const { Notification } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { parseId } = require('../utils/validate');

exports.list = asyncHandler(async (req, res) => {
  const rows = await Notification.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit: 100 });
  const unread = rows.filter((n) => !n.isRead).length;
  return ok(res, { unread, notifications: rows });
});

exports.markRead = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'notification ID');
  const row = await Notification.findOne({ where: { id, userId: req.user.id } });
  if (!row) throw new AppError(404, 'Notification not found', 'NOT_FOUND');
  await row.update({ isRead: true });
  return ok(res, row, 'Marked as read');
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });
  return ok(res, null, 'All notifications marked as read');
});
