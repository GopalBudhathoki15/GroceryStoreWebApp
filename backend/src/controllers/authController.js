const jwt = require('jsonwebtoken');

const buildUsers = () => {
  const users = [];

  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    users.push({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      name: process.env.ADMIN_NAME || 'Administrator',
    });
  }

  if (process.env.STAFF_USERNAME && process.env.STAFF_PASSWORD) {
    users.push({
      username: process.env.STAFF_USERNAME,
      password: process.env.STAFF_PASSWORD,
      role: 'staff',
      name: process.env.STAFF_NAME || 'Staff',
    });
  }

  return users;
};

const login = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const users = buildUsers();
  const matchedUser = users.find(
    (user) => user.username === username && user.password === password
  );

  if (!matchedUser) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const payload = {
    username: matchedUser.username,
    role: matchedUser.role,
    name: matchedUser.name,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

  return res.json({ token, user: payload });
};

const getProfile = (req, res) => {
  return res.json({ user: req.user });
};

module.exports = { login, getProfile };
