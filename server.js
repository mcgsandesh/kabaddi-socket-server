const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let globalAppData = {
    activeMatches: {},       
    completedMatches: {},    
    tournaments: {},         
    playersStats: {}         
};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    // =================================================================
    // १. होम पेज कनेक्ट झाल्यावर: ताजी यादी मागणे
    // =================================================================
    socket.on("request_all_active_matches", () => {
        const currentLiveList = Object.values(globalAppData.activeMatches);
        
        console.log(`\n🔍 [SERVER INQUIRY]: युझर ${socket.id} ने लाईव्ह मॅचेस मागितल्या.`);
        console.log(`📊 सध्या मेमरीमध्ये असलेले एकूण सामने: ${currentLiveList.length}`);
        if (currentLiveList.length > 0) {
            console.log("🆔 मेमरीमधील उपलब्ध मॅच IDs:", currentLiveList.map(m => m.matchId));
        } else {
            console.log("⚠️ मेमरी पूर्णपणे कोरी आहे (No Active Matches in Memory).");
        }
        
        socket.emit("live_matches_update", currentLiveList);
    });

    // =================================================================
    // २. स्कोअरर पॅनेल इव्हेंट: आयडी आणि कीजचे कडक चेकिंग
    // =================================================================
    socket.on('match_status_changed_or_updated', (matchData) => {
        if (!matchData) {
            console.log("🚨 [SERVER ERROR]: स्कोअररकडून आलेला डेटा 'null' किंवा 'undefined' आहे!");
            return;
        }

        // 🆔 [ID EXTRACTION LOGIC]: स्कोअरर पॅनेलवरून पाठवलेले सर्व संभाव्य ID प्रकार तपासणे
        const incomingId = matchData.matchId || matchData.mId || matchData.id;
        const incomingTourId = matchData.tournamentId || matchData.tId;
        const rawStatus = matchData.status || "Live";
        const currentStatus = rawStatus.trim().toLowerCase();

        console.log(`\n📥 [SERVER INCOMING DATA]: स्कोअररकडून मेसेज धडकला!`);
        console.log(`👉 मिळेलेला मॅच ID: "${incomingId}" | टूर्नामेंट ID: "${incomingTourId}" | स्टेटस: "${rawStatus}"`);

        // जर आयडी सापडलाच नाही तर इथेच एरर पकडणे
        if (!incomingId) {
            console.log("%c🚨 [ID CRITICAL ERROR]: स्कोअररच्या डेटामध्ये कोणताही ID (matchId / mId / id) सापडला नाही! पॅलोड खराब आहे.", "color: red; font-weight: bold;");
            console.log("📦 खराब आलेला पॅलोड:", matchData);
            return;
        }

        if (
            currentStatus === "live" || 
            currentStatus === "started" || 
            currentStatus === "1st_half_end" || 
            currentStatus === "half time" || 
            currentStatus === "half_time"
        ) {
            
            // 🎯 सर्व्हर मेमरीमध्ये आयडी गोंधळ मिटवण्यासाठी आपण 'matchId' आणि 'tournamentId' या दोनच कीज फिक्स ठेवू!
            globalAppData.activeMatches[incomingId] = {
                matchId: incomingId,
                tournamentId: incomingTourId || "",
                round: matchData.round || matchData.roundName || "League Match",
                teamA: matchData.teamA || matchData.teamAName || "Team A",
                teamB: matchData.teamB || matchData.teamBName || "Team B",
                scoreA: matchData.scoreA !== undefined ? Number(matchData.scoreA) : 0,
                scoreB: matchData.scoreB !== undefined ? Number(matchData.scoreB) : 0,
                status: rawStatus, 
                lastRaid: matchData.lastRaid || null
            };
            
            console.log(`✅ [SERVER MEMORY LOCK]: मॅच "${incomingId}" मेमरी कप्प्यात यशस्वीरित्या सेव्ह झाली!`);
            console.log("📋 सध्या मेमरीमधील सर्व चालू मॅच IDs:", Object.keys(globalAppData.activeMatches));

        } else if (currentStatus === "completed" || currentStatus === "finished") {
            globalAppData.completedMatches[incomingId] = matchData;
            delete globalAppData.activeMatches[incomingId];
            console.log(`🗑️ [SERVER MEMORY REMOVE]: मॅच "${incomingId}" संपल्यामुळे लाईव्हमधून काढली.`);
        }

        // 📢 ब्रॉडकास्ट
        const finalLiveList = Object.values(globalAppData.activeMatches);
        io.emit("live_matches_update", finalLiveList);
    });

    socket.on('disconnect', () => {
        console.log(`❌ युझर डिस्कनेक्ट झाला: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 कबड्डी सॉकेट सर्व्हर पोर्ट ${PORT} वर जिवंत झाला आहे!`);
});
