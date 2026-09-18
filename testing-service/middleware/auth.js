import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || "HS256";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION && !JWT_SECRET) {
  throw new Error("JWT_SECRET_KEY must be configured in production.");
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (!IS_PRODUCTION) {
      req.user = {
        id: "00000000-0000-0000-0000-000000000001",
        role: req.headers["x-demo-role"] || "student",
      };
      return next();
    }
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  // Demo shortcuts are available only outside production.
  if (!IS_PRODUCTION) {
    if (token === "student" || token === "student_token") {
      req.user = { id: "00000000-0000-0000-0000-000000000001", role: "student" };
      return next();
    }
    if (token === "test_creator" || token === "creator_token") {
      req.user = { id: "00000000-0000-0000-0000-000000000002", role: "test_creator" };
      return next();
    }
    if (token === "admin" || token === "admin_token") {
      req.user = { id: "00000000-0000-0000-0000-000000000003", role: "admin" };
      return next();
    }
    if (token === "student-new-unpurchased") {
      req.user = { id: "00000000-0000-0000-0000-000000000099", role: "student" };
      return next();
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    const userId = decoded.sub || decoded.id || decoded.user_id;
    if (!userId) return res.status(401).json({ message: "Token does not contain a user id" });
    req.user = {
      id: userId,
      email: decoded.email,
      role: decoded.role || "student",
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireTestCreator = (req, res, next) => {
  if (req.user && ["test_creator", "admin", "super_admin"].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: "Test Creator access required" });
};

export const requireStudent = (req, res, next) => {
  if (req.user && ["student", "admin", "super_admin", "test_creator"].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: "Student access required" });
};

export const requireAdmin = (req, res, next) => {
  if (req.user && ["admin", "super_admin"].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
};

export default authMiddleware;
