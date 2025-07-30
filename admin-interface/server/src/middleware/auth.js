const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'xVmE8Q7F+Rd3YKZPlm9cwXQ7RHLvW8Ij6N2BaMnKt1s=';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

module.exports = authMiddleware;