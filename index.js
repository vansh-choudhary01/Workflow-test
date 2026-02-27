import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import cors from 'cors';
import apiRoutes from './routes/index.js';

const app = express();

function connectDB() {
  mongoose.connect(process.env.DBURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
      console.error('Error connecting to MongoDB:', err);
      process.exit(1);
    });
}
connectDB();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Healthy!');
});

app.use("/api", apiRoutes);

app.use((err, req, res, next) => {
  return res.status(500).json({ message: err.message });
});

app.use((req, res, next) => {
  return res.status(404).json({ message: 'Not found' });
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});