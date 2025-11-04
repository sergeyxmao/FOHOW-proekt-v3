import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export async function authenticateToken(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return reply.code(401).send({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Используем userId из токена
    request.user = {
      id: decoded.userId,
      email: decoded.email
    };
  } catch (err) {
    return reply.code(403).send({ error: 'Недействительный токен' });
  }
}
