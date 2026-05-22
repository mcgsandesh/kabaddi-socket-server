const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS पॉलिसी सेट केली जेणेकरून तुझ्या GitHub Pages वरून डेटा इथे येईल
const io = new Server(server, {
    cors: {
        origin: "*", // सर्व डोमेन्सना परवानगी दिली
        methods: ["GET", "POST"]
    }
});

// चालू सामन्याचा स्कोअर मेमरीमध्ये साठवण्यासाठी (हवेतला बॅकअप)
let globalLiveScore = {};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    // नवीन युझर आल्यावर त्याला थेट चालू असलेला लेटेस्ट स्कोअर पाठवून देणे
    socket.emit('initial_score_sync', globalLiveScore);

    // १. स्कोअरर कडून येणारा लाईव्ह स्कोअर ऐकणे
    socket.on('update_score_from_scorer', (data) => {
        globalLiveScore = data; // मेमरी अपडेट केली
        
        // २. तोच स्कोअर सर्व प्रेक्षकांना हवेत फॉरवर्ड (Broadcast) करणे 📢
        socket.broadcast.emit('live_score_broadcast', data);
    });

    socket.on('disconnect', () => {
        console.log(`❌ युझर डिस्कनेक्ट झाला: ${socket.id}`);
    });
});

// Render ऑटोमॅटिकली PORT व्हेरिएबल पुरवतो, नसेल तर 3000 वापरेल
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 कबड्डी सॉकेट सर्व्हर पोर्ट ${PORT} वर जिवंत झाला आहे!`);
});