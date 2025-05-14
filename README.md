|||
|---|---|
|ДИСЦИПЛИНА|Интеграция информационных систем с использованием API и микросервисов|
|Подразделение|ПИШ СВЧ-электроники|
|ВИД УЧЕБНОГО МАТЕРИАЛА|Методические указания к практическим занятиям|
|ПРЕПОДАВАТЕЛЬ|Астафьев Рустам Уралович|
|СЕМЕСТР|1 семестр, 2024/2025 уч. год|

Ссылка на GitHub репозиторий:
https://github.com/astafiev-rustam/Integration-of-information-systems/tree/Practice-1-9

## Практическое занятие №9 - Аутентификация (OAuth2, JWT). Управление версиями API

## **Введение**  
Аутентификация и авторизация — ключевые аспекты безопасности современных веб-приложений. В этом занятии мы разберём два важных механизма: **JWT (JSON Web Tokens)** и **OAuth2**.  

JWT — это стандарт для создания токенов, которые позволяют передавать информацию между клиентом и сервером в зашифрованном виде. OAuth2 — это протокол, который позволяет приложениям получать ограниченный доступ к данным пользователя без передачи пароля.  

Мы начнём с теории, затем разберём примеры на Node.js и закончим практическим заданием, где реализуем аутентификацию с JWT и интеграцию OAuth2.  

---

## **Теоретическая часть**  

### **JWT (JSON Web Token)**  
JWT — это компактный способ передачи данных между сторонами в виде JSON-объекта. Токен состоит из трёх частей:  

**1. Header**  
Содержит метаданные, такие как алгоритм подписи (`HS256`, `RS256`) и тип токена (`JWT`). Пример:  
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```  

**2. Payload**  
Хранит полезные данные (claims), например, идентификатор пользователя, его роль и время жизни токена. Пример:  
```json
{
  "userId": 123,
  "role": "admin",
  "exp": 1735689600
}
```  

**3. Signature**  
Создаётся путём кодирования header и payload с использованием секретного ключа. Это гарантирует, что токен не был изменён.  

**Преимущества JWT:**  
- **Stateless** — серверу не нужно хранить сессии.  
- **Универсальность** — можно использовать в микросервисах.  
- **Безопасность** — подпись предотвращает подделку.  

**Недостатки JWT:**  
- Токен нельзя отозвать без дополнительных механизмов (например, чёрного списка).  
- Если токен украден, злоумышленник может использовать его до истечения срока действия.  

---

### **OAuth2**  
OAuth2 — это протокол для **делегирования доступа**. Он позволяет приложениям получать доступ к данным пользователя без передачи пароля.  

**Основные роли в OAuth2:**  
- **Resource Owner** — пользователь, который владеет данными.  
- **Client** — приложение, запрашивающее доступ.  
- **Authorization Server** — сервер, который выдаёт токены (например, Google, GitHub).  
- **Resource Server** — API, защищённое токеном.  

**Основные флоу OAuth2:**  
1. **Authorization Code Flow** — самый безопасный, используется в веб-приложениях.  
2. **Implicit Flow** (устарел) — использовался в SPA, но считается небезопасным.  
3. **Client Credentials** — для сервис-сервисной аутентификации.  
4. **Password Grant** — передача логина и пароля (не рекомендуется).  

---

## **Практическая часть**  

### **Пример 1: Реализация JWT в Node.js**  
Создадим простое API с аутентификацией через JWT.  

**1. Установка зависимостей:**  
```bash
npm init -y
npm install express jsonwebtoken body-parser
```  

**2. Сервер (`server.js`):**  
```javascript
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
```  

**3. Тестирование:**  
- Запустите сервер: `node server.js`.  
- Отправьте POST-запрос на `/login`:  
  ```PowerShell
  Invoke-WebRequest `
  -Uri "http://localhost:3000/login" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"username":"admin","password":"123"}'
  ```
  
- Ответ:
  ```PowerShell
    StatusCode        : 200
    StatusDescription : OK
    Content           : {"token":"..."}
    RawContent        : HTTP/1.1 200 OK
                        Connection: keep-alive
                        Keep-Alive: timeout=5
                        Content-Length: 175
                        Content-Type: application/json; charset=utf-8
                        Date: Wed, 14 May 2025 06:23:14 GMT
                        ETag: W/"af-bq7Uf3MBBM+C8my/l7k...
    Forms             : {}
    Headers           : {[Connection, keep-alive], [Keep-Alive, timeout=5], [Content-Length, 175], [Content-Type, application/json; charset=utf-8]...}
    Images            : {}
    InputFields       : {}
    Links             : {}
    ParsedHtml        : mshtml.HTMLDocumentClass
    RawContentLength  : 175
  ```

- Проверьте `/profile` с токеном:

  ```PowerShell
    $token = "..."
    Invoke-WebRequest -Uri "http://localhost:3000/profile" -Headers @{ "Authorization" = "Bearer $token" }
  ```

---

### **Пример 2: Интеграция OAuth2 (Google)**

**ВАЖНО! ЭТО ПРИМЕР, ВЫПОЛНЯТЬ ДЕЙСТВИЯ НЕ НУЖНО, ТАК КАК НЕОБХОДИМ ПЛАТЕЖНЫЙ АККАУНТ СЕРВИСА. ПРИМЕР ТОЛЬКО ДЛЯ ОЗНАКОМЛЕНИЯ СО СТРУКТУРОЙ КОДА**

Реализуем вход через Google OAuth2.  

**1. Настройка Google OAuth:**  
- Зайдите в [Google Cloud Console](https://console.cloud.google.com/).  
- Создайте проект и добавьте OAuth 2.0 Client ID.  
- Укажите `http://localhost:3000/auth/google/callback` как **Redirect URI**.  

**2. Установка зависимостей:**  
```bash
npm install passport passport-google-oauth20 express-session
```  

**3. Сервер (`oauth-server.js`):**  
```javascript
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();

app.use(session({ secret: 'your_secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: 'YOUR_GOOGLE_CLIENT_ID',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
    callbackURL: 'http://localhost:3000/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

app.get('/profile', (req, res) => {
  if (!req.user) return res.redirect('/auth/google');
  res.json(req.user);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```  

**4. Тестирование:**  
- Перейдите по `http://localhost:3000/auth/google`.  
- Авторизуйтесь через Google.  
- После редиректа вы увидите данные профиля.  

---

## Полезные материалы
- [JWT.io](https://jwt.io/) – декодер и документация.  
- [OAuth 2.0 Simplified](https://oauth2simplified.com/) – гайд по OAuth2.  
- [RFC 6749](https://tools.ietf.org/html/rfc6749) – официальная спецификация OAuth2.  

## Практическое задание
В рамках задания по текущему занятию необходимо добавить простую аутентификацию для пользователей системы интернет-магазина (на основе одной из предыдущих практик)

## **Заключение**  
Мы разобрали:  
- Как работает JWT и как его использовать для аутентификации.  
- Основы OAuth2 и интеграцию с Google.  
