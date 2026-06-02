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

        // 🚨 [💥 NEW STATUS GATEKEEPER]: ५-५ आणि सुवर्ण रेडच्या स्टेटसला परवानगी देणे
        if (
            statusCheck === "Live" || 
            statusCheck === "live" || 
            statusCheck === "1st_Half_End" || 
            statusCheck === "1st_half_end" ||
            statusCheck === "half time" ||
            statusCheck === "half_time" ||
            statusCheck === "started" ||
            statusCheck === "five_raid" ||       // 🟢 ५-५ मोड चालू असताना
            statusCheck === "golden_raid"       // 🟢 सुवर्ण रेड चालू असताना
        ) {
            
            // सर्व्हर मेमरीमध्ये कडक लॉक
            globalAppData.activeMatches[combinedKey] = {
                matchId: incomingId,
                tournamentId: incomingTourId || "",
                round: matchData.round || "League Match",
                teamA: matchData.teamA || "Team A",
                teamB: matchData.teamB || "Team B",
                status: statusCheck, 
                lastRaid: matchData.lastRaid || null,
                
                // 🎯 [SINGLE SOURCE OF TRUTH]: सुटे आकडे काढून थेट मास्टर ऑब्जेक्ट सर्व्हर RAM मध्ये सेव्ह!
                scoreCard: matchData.scoreCard || {
                    mainMatch:  { teamA: Number(matchData.scoreA || 0), teamB: Number(matchData.scoreB || 0) },
                    fiveRaid:   { teamA: 0, teamB: 0 },
                    goldenRaid: { teamA: 0, teamB: 0 }
                },
                
                // सर्व्हर RAM मध्ये इतर पूर्ण डेटा सुरक्षित
                timeline: matchData.timeline || [],
                statsA: matchData.statsA || [],
                statsB: matchData.statsB || []
            };
            
            console.log(`\n💾 [SERVER MEMORY UPDATED]: की "${combinedKey}" [Status: ${statusCheck}] यशस्वी लॉक!`);
            console.log(`📊 मुख्य स्कोअर -> A: ${globalAppData.activeMatches[combinedKey].scoreCard.mainMatch.teamA} vs B: ${globalAppData.activeMatches[combinedKey].scoreCard.mainMatch.teamB}`);

        } else if (statusCheck.toLowerCase() === "completed" || statusCheck.toLowerCase() === "finished") {
            globalAppData.completedMatches[combinedKey] = matchData;
            delete globalAppData.activeMatches[combinedKey];
            console.log(`🗑️ [REMOVE]: मॅच ${incomingId} मेमरीमधून क्लिन केली (सामना संपला).`);
        }

        // सर्व कनेक्टेड प्रेक्षकांना (Live Display Screens) फ्रेश लिस्ट ब्रॉडकास्ट करणे
        const finalLiveList = Object.values(globalAppData.activeMatches);
        io.emit("live_matches_update", finalLiveList);
    });

    socket.on('disconnect', () => { console.log(`❌ युझर डिस्कनेक्ट: ${socket.id}`); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 सॉकेट सर्व्हर रेडी पोर्ट ${PORT} वर!`); });
