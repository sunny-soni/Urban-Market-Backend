function isAdminMiddleware(req, res, next) {
  const userId = req.userId;
  if (userId !== 1) {
    return res.status(403).json({ message: "Admin access required!" });
  }
  next();
}

export default isAdminMiddleware;
