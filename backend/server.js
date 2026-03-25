const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { initDatabase } = require('./db/init');
const productsRoutes = require('./routes/productsRoutes');
const clientsRoutes = require('./routes/clientsRoutes');
const mouvementsRoutes = require('./routes/mouvementsRoutes');
const commandesRoutes = require('./routes/commandesRoutes');
const reportRoutes = require('./routes/reportRoutes');
const systemRoutes = require('./routes/systemRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API EGK opérationnelle' });
});

app.use('/api/products', productsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/mouvements', mouvementsRoutes);
app.use('/api/commandes', commandesRoutes);
app.use('/api', reportRoutes);
app.use('/api/system', systemRoutes);

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) return notFoundHandler(req, res);
  return res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
