import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Invalid Authorization header format');
      return res.status(401).json({ message: 'Invalid Authorization header format' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded || !decoded.id) {
      console.log('Invalid token payload');
      return res.status(401).json({ message: 'Invalid token payload' });
    }
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.log('User not found for token:', decoded.id);
      return res.status(401).json({ message: 'Token is valid but user not found' });
    }

    // Check if user is active and not suspended
    if (user.status === 'suspended') {
      console.log('User account is suspended:', user._id);
      return res.status(403).json({ message: 'Your account has been suspended' });
    }

    // Add user info to request
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    console.log('Authenticated user:', {
      id: req.user.id,
      role: req.user.role,
      endpoint: req.originalUrl,
      method: req.method,
      headers: {
        authorization: 'Bearer [REDACTED]',
        ...req.headers
      }
    });

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
}; 