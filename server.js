const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 🔒 CORS पॉलिसी सेट केली जेणेकरून तुझ्या GitHub Pages वरून डेटा इथे येईल
const io = new Server(server, {
    cors: {
        origin: "*", // सर्व डोमेन्सना परवानगी दिली
        methods: ["GET", "POST"]
    }
});

// 🧠 [SCALABLE GLOBAL MEMORY] - भविष्यातील विस्तारासाठी तयार केलेली मध्यवर्ती मेमरी
let globalAppData = {
    activeMatches: {},       // सध्या मैदानावर सुरू असलेले सर्व सामने (Live / 1st_Half_End)
    completedMatches: {},    // 🏆 फ्युचरसाठी: संपलेले सामने (History)
    tournaments: {},         // 🏟️ फ्युचरसाठी: सर्व स्पर्धांचा डेटा
    playersStats: {}         // 🏃 फ्युचरसाठी: प्लेअर्सचे लाईव्ह आकडे / रेड-टॅकल पॉईंट्स
};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    // =================================================================
    // १. होम पेज कनेक्ट झाल्यावर: त्याला सर्व चालू सामने पहिल्याच सेकंदाला मिळणे
    // =================================================================
    socket.on("request_all_active_matches", () => {
        const currentLiveList = Object.values(globalAppData.activeMatches);
        console.log(`📡 युझर ${socket.id} ला एकूण ${currentLiveList.length} लाईव्ह सामने पाठवले.`);
        
        // फक्त मागणी करणाऱ्या युझरला ताजी लिस्ट पाठवणे
        socket.emit("live_matches_update", currentLiveList);
    });

    // =================================================================
    // २. स्कोअरर पॅनेल इव्हेंट: सामना सुरू करणे, स्कोअर अपडेट करणे किंवा संपवणे
    // =================================================================
    socket.on('match_status_changed_or_updated', (matchData) => {
        if (!matchData || !matchData.mId) return;

        const mId = matchData.mId;
        const currentStatus = matchData.status ? matchData.status.trim().toLowerCase() : "";

        // 🎯 नियम: जर सामना 'live' किंवा '1st_half_end' असेल, तर तो 'Active' कप्प्यात राहील
        if (currentStatus === "live" || currentStatus === "1st_half_end" || currentStatus === "half time" || currentStatus === "started") {
            
            globalAppData.activeMatches[mId] = {
                matchId: mId,
                tournamentId: matchData.tId || matchData.tournamentId || "",
                round: matchData.roundName || matchData.round || "League Match",
                teamA: matchData.teamNameA || matchData.teamA || "Team A",
                teamB: matchData.teamNameB || matchData.teamB || "Team B",
                scoreA: Number(matchData.scoreA) || 0,
                scoreB: Number(matchData.scoreB) || 0,
                status: matchData.status || "Live",
                lastRaid: matchData.lastRaid || null
            };
            console.log(`📝 सामना ${mId} लाईव्ह यादीत अपडेट झाला.`);

        } else if (currentStatus === "completed" || currentStatus === "finished") {
            
            // 🏆 सामना संपला की त्याला 'Active' मधून काढून 'Completed' मध्ये ढकलणे
            globalAppData.completedMatches[mId] = matchData;
            delete globalAppData.activeMatches[mId];
            console.log(`🗑️ सामना ${mId} संपल्यामुळे लाईव्हमधून काढून इतिहासामध्ये सेव्ह केला.`);
        }

        // 📢 पूर्ण गावाला (सर्व प्रेक्षकांना) नवीन ताजी यादी ब्रॉडकास्ट करणे
        io.emit("live_matches_update", Object.values(globalAppData.activeMatches));
    });

    // =================================================================
    // 🚀 फ्युचर डेव्हलपमेंटसाठी अतिरिक्त हुक्स (भविष्यात काम सोपं होईल)
    // =================================================================
    socket.on('future_tournament_update', (tourData) => {
        if (tourData && tourData.tId) globalAppData.tournaments[tourData.tId] = tourData;
    });

    socket.on('future_player_update', (playerData) => {
        if (playerData && playerData.pId) globalAppData.playersStats[playerData.pId] = playerData;
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
