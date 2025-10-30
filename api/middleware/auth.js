import jwt from 'jsonwebtoken';

export async function authenticateToken(request, reply) {
  try {
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return reply.code(401).send({ error: 'Токен не предоставлен' });
    }

    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Добавляем данные пользователя в request
    request.user = decoded;
    
  } catch (err) {
    return reply.code(403).send({ error: 'Недействительный токен' });
  }
}
