const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const SECRET_KEY = 'your_secret_key_here';

// Эндпоинт для входа
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // В реальном приложении проверяем в БД
  if (username === 'admin' && password === '123') {
    const token = jwt.sign(
      { userId: 1, role: 'admin' },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Защищённый эндпоинт
app.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json({ userId: decoded.userId, role: decoded.role });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});