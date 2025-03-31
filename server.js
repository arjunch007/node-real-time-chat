const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require("socket.io");
const initializeSocket = require('./socketHandler');
const path = require('path');

// Environment Configuration
require('dotenv').config();

// Express App Initialization
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5000;


// Get local IP
const os = require('os');
const { log } = require('console');
const HOST = Object.values(os.networkInterfaces())
    .flat()
    .find(interface => interface.family === 'IPv4' && !interface.internal)?.address || 'localhost';

const isDevelopment = ['development', 'local'].includes(process.env.NODE_ENV);

const getOrigins = () => {
    switch(process.env.NODE_ENV) {
        case 'production':
            return ['https://your-production-domain.com'];
        case 'staging':
            return ['https://staging.your-domain.com'];
        default:
            return [
                `http://localhost:${PORT}`,
                `http://${HOST}:${PORT}`
            ];
    }
};

const allowedOrigins = getOrigins();

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) {
            // Allow requests with no origin (like mobile apps or curl requests)
            return callback(null, true);
        }

        if (isDevelopment && origin.includes('ngrok-free.app')) {
            // Allow ngrok URLs in development
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            // Allow configured origins
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(bodyParser.json());
// app.use(express.json());  // will use this
app.use(cookieParser());

// Serve static files from node_modules
app.use('/assets', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));
app.use(express.static("realtime-chat"));
app.use('/storage/uploads/chat', express.static(path.join(__dirname, 'storage', 'uploads', 'chat')));

// Routes
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/realtime-chat/index.html");
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/messages', require('./routes/chatRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Initialize Socket.IO
initializeSocket(io);

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

// Initialize Database & Server
connectDB().then(() => {
    server.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}. Access it at: http://localhost:${PORT}/`);
        console.log(`Server running at local ip http://${HOST}:${PORT}`);

        const isDevelopment = ['development', 'local'].includes(process.env.NODE_ENV);
        if (isDevelopment) {
            // Start ngrok if we're in local
            try {
                const ngrok = require('ngrok');
                const url = await ngrok.connect({
                    addr: PORT,
                    authtoken: process.env.NGROK_AUTH_TOKEN // Optional but recommended
                });
                console.log(`Ngrok tunnel running at: ${url}`);
            } catch (err) {
                console.error('Ngrok error:', err);
            }
        }
    });
});