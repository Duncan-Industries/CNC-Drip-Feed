// server.js

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const readline = require('readline');
const socketIo = require('socket.io');
const http = require('http');
const { SerialPort } = require('serialport');
const cron = require('node-cron'); // Added for scheduling tasks

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer storage with safe file naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize the filename to prevent security issues
    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeFilename);
  },
});

// Validate uploaded files to allow only .gcode and .nc files
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.gcode', '.nc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Only .gcode and .nc files are allowed.'));
    }
    cb(null, true);
  },
});

// Serve static files securely
app.use(
  express.static('public', {
    index: 'index.html',
    extensions: ['html'],
  })
);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fetch available COM ports and filter for Linux-compatible paths
app.get('/com-ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    const linuxPorts = ports.filter((port) => port.path.startsWith('/dev/tty'));
    res.json({ ports: linuxPorts });
  } catch (error) {
    console.error('Error listing ports:', error.message);
    res.status(500).json({ ports: [], error: error.message });
  }
});

// File upload route with validation
app.post('/upload', upload.single('gcode'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const gcodePath = path.join(__dirname, req.file.path);
  const baudRate = parseInt(req.body.baudRate, 10);
  const comPort = req.body.comPort;

  // Validate baud rate
  if (isNaN(baudRate) || baudRate <= 0) {
    return res.status(400).json({ message: 'Invalid baud rate provided.' });
  }

  // Validate COM port
  if (!comPort) {
    return res
      .status(400)
      .json({ message: 'COM port is undefined. Please select a valid COM port.' });
  }

  res.json({ filepath: gcodePath, baudRate, comPort });
});

io.on('connection', (socket) => {
  console.log('Client connected.');

  // Test baud rate event handler with validation
  socket.on('test-baud-rate', async (data) => {
    const { baudRate, comPort } = data;

    if (!comPort) {
      console.log('Error: COM port is undefined.');
      socket.emit('baud-rate-test-result', {
        success: false,
        message: 'COM port is undefined. Please select a valid COM port.',
      });
      return;
    }

    if (isNaN(baudRate) || baudRate <= 0) {
      socket.emit('baud-rate-test-result', {
        success: false,
        message: 'Invalid baud rate provided.',
      });
      return;
    }

    console.log(`Testing COM port: ${comPort} at baud rate: ${baudRate}`);

    try {
      const port = new SerialPort({
        path: comPort,
        baudRate,
        autoOpen: false,
      });

      await new Promise((resolve, reject) => {
        port.open((err) => {
          if (err) {
            console.log(`Failed to open port ${comPort} at baud rate ${baudRate}:`, err.message);
            socket.emit('baud-rate-test-result', {
              success: false,
              baudRate,
              comPort,
              message: err.message,
            });
            reject(err);
          } else {
            console.log(`Successfully opened port ${comPort} at baud rate ${baudRate}`);
            port.close((err) => {
              if (err) {
                console.log('Error closing port:', err.message);
              } else {
                console.log('Port closed successfully.');
              }
            });
            socket.emit('baud-rate-test-result', { success: true, baudRate, comPort });
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`Error initializing SerialPort for ${comPort}: ${error.message}`);
      socket.emit('baud-rate-test-result', { success: false, message: error.message });
    }
  });

  // Drip-feed event handler with resource management and error handling
  socket.on('drip-feed', async (data) => {
    const { filepath, baudRate, comPort } = data;

    console.log(`Received COM Port: ${comPort}`);

    if (!comPort) {
      console.log('Error: COM port is undefined.');
      socket.emit('error', { message: 'Please select a COM port before starting.' });
      return;
    }

    if (isNaN(baudRate) || baudRate <= 0) {
      socket.emit('error', { message: 'Invalid baud rate provided.' });
      return;
    }

    // Check if G-code file exists and is not empty
    try {
      const stats = await fsPromises.stat(filepath);
      if (stats.size === 0) {
        socket.emit('error', { message: 'G-code file is empty.' });
        return;
      }
    } catch (err) {
      socket.emit('error', { message: 'G-code file is not accessible.' });
      return;
    }

    try {
      const port = new SerialPort({
        path: comPort,
        baudRate,
        autoOpen: false,
      });

      // Handle serial port errors
      port.on('error', (err) => {
        console.error('Serial port error:', err.message);
        port.close();
        socket.emit('error', { message: err.message });
      });

      await new Promise((resolve, reject) => {
        port.open(async (err) => {
          if (err) {
            console.log('Error opening port:', err.message);
            socket.emit('error', { message: `Failed to open port ${comPort}: ${err.message}` });
            return reject(err);
          }
          console.log(`Port opened at baud rate ${baudRate} on ${comPort}`);

          // Calculate total lines for progress tracking
          let totalLines = 0;
          try {
            totalLines = await countLinesInFile(filepath);
            if (totalLines === 0) {
              socket.emit('error', { message: 'G-code file is empty.' });
              port.close();
              return reject(new Error('G-code file is empty.'));
            }
          } catch (countError) {
            socket.emit('error', { message: 'Failed to count lines in G-code file.' });
            port.close();
            return reject(countError);
          }

          const rl = readline.createInterface({
            input: fs.createReadStream(filepath),
            crlfDelay: Infinity,
          });

          // Handle readline errors
          rl.on('error', (err) => {
            console.error('Readline error:', err.message);
            port.close();
            socket.emit('error', { message: err.message });
            reject(err);
          });

          let linesSent = 0;

          rl.on('line', (line) => {
            rl.pause(); // Pause the stream to control flow

            if (port.writable) {
              port.write(`${line}\n`, (err) => {
                if (err) {
                  console.log('Error writing to port:', err.message);
                  port.close();
                  socket.emit('error', { message: err.message });
                  rl.close();
                  reject(err);
                } else {
                  linesSent++;
                  const percentComplete = Math.floor((linesSent / totalLines) * 100);
                  socket.emit('progress', percentComplete);
                  console.log(`Sent to CNC: ${line}`);
                  socket.emit('gcode-line', line);
                  rl.resume(); // Resume the stream
                }
              });
            } else {
              console.log('Port is not writable.');
              port.close();
              socket.emit('error', { message: 'Port is not writable.' });
              rl.close();
              reject(new Error('Port is not writable.'));
            }
          });

          rl.on('close', () => {
            console.log('G-code file completed.');
            port.close((err) => {
              if (err) {
                console.log('Error closing port:', err.message);
              } else {
                console.log('Port closed.');
              }
            });
            socket.emit('gcode-complete', 'G-code file complete');
            resolve();
          });
        });
      });
    } catch (error) {
      console.error(`Error during drip-feed operation: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });
});

// Function to count lines in a file
async function countLinesInFile(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (buffer) => {
        let idx = -1;
        lineCount--; // Because the loop will run once for idx=-1
        do {
          idx = buffer.indexOf(10, idx + 1);
          lineCount++;
        } while (idx !== -1);
      })
      .on('end', () => {
        resolve(lineCount);
      });
  });
}

// Scheduled task to delete files older than 30 days
cron.schedule('0 0 * * *', async () => {
  // This cron job runs every day at midnight
  console.log('Running scheduled task to delete old files...');
  const now = Date.now();
  const files = await fsPromises.readdir(uploadsDir);

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    try {
      const stats = await fsPromises.stat(filePath);
      const fileAgeInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      if (fileAgeInDays > 30) {
        await fsPromises.unlink(filePath);
        console.log(`Deleted old file: ${file}`);
      }
    } catch (err) {
      console.error(`Error deleting file ${file}:`, err.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
