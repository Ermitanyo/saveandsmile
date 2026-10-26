const { Service } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/respond');
const { Validator, parseId } = require('../utils/validate');

const validateService = (body) => {
  const v = new Validator(body);
  v.string('name', { label: 'Service name', min: 2, max: 120 })
    .string('description', { label: 'Description', required: false, max: 1000 })
    .integer('durationMinutes', { label: 'Duration (minutes)', min: 15, max: 480 });
  if (body && body.durationMinutes !== undefined && Number(body.durationMinutes) % 5 !== 0) {
    v.fail('durationMinutes', 'Duration must be in steps of 5 minutes');
  }
  return v.done();
};

// Public: only active services (shown on the website and booking page)
exports.listActive = asyncHandler(async (req, res) => {
  const services = await Service.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  return ok(res, services);
});

// Staff / admin: every service including deactivated ones
exports.listAll = asyncHandler(async (req, res) => {
  const services = await Service.findAll({ order: [['name', 'ASC']] });
  return ok(res, services);
});

exports.create = asyncHandler(async (req, res) => {
  const data = validateService(req.body);
  if (await Service.findOne({ where: { name: data.name } })) {
    throw new AppError(409, 'A service with this name already exists', 'DUPLICATE', { name: 'Name already used' });
  }
  const service = await Service.create(data);
  return created(res, service, 'Service created');
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'service ID');
  const service = await Service.findByPk(id);
  if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
  const data = validateService(req.body);

  const clash = await Service.findOne({ where: { name: data.name } });
  if (clash && clash.id !== id) throw new AppError(409, 'A service with this name already exists', 'DUPLICATE', { name: 'Name already used' });

  await service.update(data);
  return ok(res, service, 'Service updated');
});

// Services are deactivated, not deleted, so old appointments keep their service.
exports.setStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'service ID');
  const service = await Service.findByPk(id);
  if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
  const { isActive } = new Validator(req.body).boolean('isActive', { required: true }).done();
  await service.update({ isActive });
  return ok(res, service, isActive ? 'Service activated' : 'Service deactivated');
});
