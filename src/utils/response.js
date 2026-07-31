export const successResponse = (res, status, message, data = {}) => {
  return res.status(status).json({
    status,
    message,
    data
  });
};

// `data` is optional so every existing caller keeps its exact response shape.
export const errorResponse = (res, status, message, data) => {
  const payload = { status, message };
  if (data !== undefined) payload.data = data;
  return res.status(status).json(payload);
};
