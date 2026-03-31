import jwt from "jsonwebtoken";

function authMiddleware(req, res, next) {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Expect: "Bearer TOKEN"
  const token = authHeader.split(" ")[1];
  console.log("🚀 ~ authMiddleware ~ token:", token)

  if (!token) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.userId = decoded.id;
    next();
  });
}

export default authMiddleware;
