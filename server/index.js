import express from 'express';
import { createClient } from '@libsql/client';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import net from 'node:net';

dotenv.config();

const DB_PATH = 'database.sqlite';

// Check if database file exists and is corrupted
const checkAndInitializeDatabase = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      try {
        const db = createClient({
          url: `file:${DB_PATH}`,
        });
        // Test the connection
        db.execute('SELECT 1');
      } catch (error) {
        console.log('Database corrupted, recreating...');
        fs.unlinkSync(DB_PATH);
      }
    }
  } catch (error) {
    console.error('Error checking database:', error);
  }
};

// Initialize express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize database
const initializeDatabase = async () => {
  try {
    checkAndInitializeDatabase();
    
    const db = createClient({
      url: `file:${DB_PATH}`,
    });

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget REAL NOT NULL,
        city TEXT NOT NULL,
        investment_type TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

let db;
let server;

// Function to check if a port is in use
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          console.error(`Error checking port ${port}:`, err);
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
};

// Graceful shutdown function
const shutdown = () => {
  if (server) {
    server.close(() => {
      console.log('Server shut down gracefully');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// Custom fetch with timeout
const fetchWithTimeout = async (url, options, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Initialize database before starting server
const startServer = async () => {
  try {
    db = await initializeDatabase();

    // Save user data
    app.post('/api/user-data', async (req, res) => {
      try {
        const { budget, city, investmentType, targetAudience } = req.body;

        const result = await db.execute({
          sql: 'INSERT INTO user_data (budget, city, investment_type, target_audience) VALUES (?, ?, ?, ?)',
          args: [budget, city, investmentType, targetAudience]
        });
        
        const insertedData = await db.execute({
          sql: 'SELECT * FROM user_data WHERE id = ?',
          args: [result.lastInsertRowid]
        });
        
        res.json(insertedData.rows[0]);
      } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({ error: 'Failed to save user data' });
      }
    });

    // Get all user data
    app.get('/api/user-data', async (req, res) => {
      try {
        const result = await db.execute('SELECT * FROM user_data ORDER BY created_at DESC');
        res.json(result.rows);
      } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
      }
    });

    // Updated proxy endpoint for the AI API
    app.post('/api/proxy/ai', async (req, res) => {
      try {
        console.log('Attempting to connect to AI API...');
        const response = await fetchWithTimeout(
          "http://26.59.53.88:7860/api/v1/run/ac325ffc-2462-42ff-aa33-292f0c33b66b?stream=false",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "sk-tjmcaGsj62BGA6iy-13F1Q9esTKx-4QLYb9u_TVL84k"
            },
            body: JSON.stringify({
              input_value: req.body.input_value,
              output_type: "chat",
              input_type: "chat",
              tweaks: {
                "Agent-2KW2O": {},
                "ChatInput-6v3mV": {},
                "PythonFunction-FcmS4": {},
                "PythonFunction-T0TgC": {},
                "NVIDIAEmbeddingsComponent-JJW34": {},
                "Chroma-ujg9M": {},
                "ChatOutput-uuXRz": {}
              }
            })
          },
          30000 // 30 second timeout
        );

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error('Error calling AI API:', error);
        if (error.name === 'AbortError') {
          res.status(504).json({ error: 'Request timeout - AI service is not responding' });
        } else {
          res.status(500).json({ error: 'Failed to process AI request' });
        }
      }
    });

    const PORT = process.env.PORT || 3000;
    
    // Check if port is in use
    const portInUse = await isPortInUse(PORT);
    if (portInUse) {
      console.log(`Port ${PORT} is already in use. Trying port ${PORT + 1}`);
      server = app.listen(PORT + 1, () => {
        console.log(`Server running on port ${PORT + 1}`);
      });
    } else {
      server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
startServer();