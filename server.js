const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 🧠 प्युअर सर्व्हर मेमरी कप्पा
let globalAppData = {
    activeMatches: {},       
    completedMatches: {}
};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    // १. होम पेज कनेक्ट झाल्यावर: ताजी यादी देणे
    socket.on("request_all_active_matches", () => {
        const currentLiveList = Object.values(globalAppData.activeMatches);
        console.log(`\n🔍 [SERVER INQUIRY]: युझर ${socket.id} ने डेटा मागितला. सामने संख्या: ${currentLiveList.length}`);
        socket.emit("live_matches_update", currentLiveList);
    });

    // २. स्कोअरर पॅनेल इव्हेंट: कम्बाईन की आणि टाईमलाईन सेव्हिंग
    socket.on('match_status_changed_or_updated', (matchData) => {
        if (!matchData) return;

        const incomingId = matchData.matchId || matchData.mId || matchData.id;
        const incomingTourId = matchData.tournamentId || matchData.tId;
        const statusCheck = matchData.status ? matchData.status.trim() : "Live";

        if (!incomingId) return;

        const combinedKey = incomingTourId ? `${incomingTourId}_${incomingId}` : incomingId;

        if (
            statusCheck === "Live" || 
            statusCheck === "live" || 
            statusCheck === "1st_Half_End" || 
            statusCheck === "1st_half_end" ||
            statusCheck === "half time" ||
            statusCheck === "half_time" ||
            statusCheck === "started"
        ) {
            
            // सर्व्हर मेमरी कप्प्यात डेटा सुरक्षित लॉक केला
            globalAppData.activeMatches[combinedKey] = {
                matchId: incomingId,
                tournamentId: incomingTourId || "",
                round: matchData.round || matchData.roundName || "League Match",
                teamA: matchData.teamA || matchData.teamAName || "Team A",
                teamB: matchData.teamB || matchData.teamBName || "Team B",
                scoreA: matchData.scoreA !== undefined ? Number(matchData.scoreA) : 0,
                scoreB: matchData.scoreB !== undefined ? Number(matchData.scoreB) : 0,
                status: statusCheck, 
                lastRaid: matchData.lastRaid || null,
                // 🎯 सर्व्हरच्या RAM मध्ये टाईमलाईन साठवली!
                timeline: matchData.timeline || [] 
            };
            
            console.log(`💾 [RAM LOCK]: की ${combinedKey} वर मॅच आणि ${globalAppData.activeMatches[combinedKey].timeline.length} रेड्स लॉक झाल्या!`);

        } else if (statusCheck.toLowerCase() === "completed" || statusCheck.toLowerCase() === "finished") {
            if (!globalAppData.completedMatches) globalAppData.completedMatches = {};
            globalAppData.completedMatches[combinedKey] = matchData;
            delete globalAppData.activeMatches[combinedKey];
            console.log(`🗑️ [REMOVE]: मॅच ${incomingId} संपल्यामुळे मेमरी क्लिन केली.`);
        }

        // ब्रॉडकास्ट
        const finalLiveList = Object.values(globalAppData.activeMatches);
        io.emit("live_matches_update", finalLiveList);
    });

    socket.on('disconnect', () => { console.log(`❌ युझर डिस्कनेक्ट: ${socket.id}`); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 सॉकेट सर्व्हर रेडी! Port: ${PORT}`); });
