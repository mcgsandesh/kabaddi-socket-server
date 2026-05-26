const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let globalAppData = {
    activeMatches: {},       
    completedMatches: {}
};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    socket.on("request_all_active_matches", () => {
        const currentLiveList = Object.values(globalAppData.activeMatches);
        socket.emit("live_matches_update", currentLiveList);
    });

    socket.on('match_status_changed_or_updated', (matchData) => {
        if (!matchData) return;

        const incomingId = matchData.matchId || matchData.mId;
        const incomingTourId = matchData.tournamentId || matchData.tId;
        const statusCheck = matchData.status ? matchData.status.trim() : "Live";

        if (!incomingId) return;

        // 🎯 टूर्नामेंट आणि मॅच आयडीची कम्बाईन युनिक की
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
            
            // सर्व्हर मेमरीमध्ये कडक लॉक
            globalAppData.activeMatches[combinedKey] = {
                matchId: incomingId,
                tournamentId: incomingTourId || "",
                round: matchData.round || "League Match",
                teamA: matchData.teamA || "Team A",
                teamB: matchData.teamB || "Team B",
                scoreA: Number(matchData.scoreA) || 0,
                scoreB: Number(matchData.scoreB) || 0,
                status: statusCheck, 
                lastRaid: matchData.lastRaid || null,
                
                // 🎯 सर्व्हर RAM मध्ये पूर्ण डेटा साठवला!
                timeline: matchData.timeline || [],
                statsA: matchData.statsA || [],
                statsB: matchData.statsB || []
            };
            
            console.log(`\n💾 [SERVER MEMORY UPDATED]: की "${combinedKey}" यशस्वी लॉक!`);
            console.log(`📊 रेड्स संख्या: ${globalAppData.activeMatches[combinedKey].timeline.length} | StatsA: ${globalAppData.activeMatches[combinedKey].statsA.length}`);

        } else if (statusCheck.toLowerCase() === "completed" || statusCheck.toLowerCase() === "finished") {
            globalAppData.completedMatches[combinedKey] = matchData;
            delete globalAppData.activeMatches[combinedKey];
            console.log(`🗑️ [REMOVE]: मॅच ${incomingId} मेमरीमधून क्लिन केली.`);
        }

        const finalLiveList = Object.values(globalAppData.activeMatches);
        io.emit("live_matches_update", finalLiveList);
    });

    socket.on('disconnect', () => { console.log(`❌ युझर डिस्कनेक्ट: ${socket.id}`); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 सॉकेट सर्व्हर रेडी पोर्ट ${PORT} वर!`); });
