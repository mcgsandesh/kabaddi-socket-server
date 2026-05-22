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
    // =================================================================
    // २. स्कोअरर पॅनेल इव्हेंट: सामना सुरू करणे, स्कोअर अपडेट करणे किंवा संपवणे
    // =================================================================
    socket.on('match_status_changed_or_updated', (matchData) => {
        if (!matchData || !matchData.mId) {
            console.log("🚨 [Server Error]: आलेला मॅच डेटा रिकामी आहे किंवा mId नाही!");
            return;
        }

        const mId = matchData.mId;
        // 🎯 फिक्स: स्टेटस लहान लिपीत करून तपासणे जेणेकरून 'Live' किंवा 'live' दोन्ही चालतील
        const currentStatus = matchData.status ? matchData.status.trim().toLowerCase() : "";

        console.log(`📡 [Server Sync]: स्कोअररकडून डेटा आला. Status: ${currentStatus}, Match ID: ${mId}`);

        // 🎯 जर सामना 'live' किंवा '1st_half_end' असेल
        if (currentStatus === "live" || currentStatus === "1st_half_end" || currentStatus === "half time" || currentStatus === "started") {
            
            // 🎯 तुझ्या 'confirmStartMatch' च्या ऑब्जेक्टमधील अचूक कीज इथे मॅप केल्या आहेत
            globalAppData.activeMatches[mId] = {
                matchId: mId,
                tournamentId: matchData.tId || "",
                round: matchData.roundName || matchData.round || "Round 1",
                teamA: matchData.teamAName || matchData.teamA || "Team A",
                teamB: matchData.teamBName || matchData.teamB || "Team B",
                scoreA: Number(matchData.scoreA) ?? 0,
                scoreB: Number(matchData.scoreB) ?? 0,
                status: matchData.status || "Live",
                lastRaid: matchData.lastRaid || null
            };
            console.log(`✅ [Memory Success]: सामना ${mId} सर्व्हरच्या लाईव्ह यादीत लॉक झाला!`);

        } else if (currentStatus === "completed" || currentStatus === "finished") {
            globalAppData.completedMatches[mId] = matchData;
            delete globalAppData.activeMatches[mId];
            console.log(`🗑️ सामना ${mId} संपल्यामुळे लाईव्हमधून काढला.`);
        }

        // 📢 सर्व प्रेक्षकांना ताजी यादी ब्रॉडकास्ट करणे
        const updatedList = Object.values(globalAppData.activeMatches);
        console.log(`📢 [Broadcast]: सर्व प्रेक्षकांना एकूण ${updatedList.length} सामने पाठवत आहे...`);
        io.emit("live_matches_update", updatedList);
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
