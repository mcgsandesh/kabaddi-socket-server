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

// 🧠 [SCALABLE GLOBAL MEMORY] - मध्यवर्ती फ्युचर-प्रूफ मेमरी रचना
let globalAppData = {
    activeMatches: {},       // सध्या मैदानावर सुरू असलेले सर्व सामने (Live, 1st_Half_End, इ.)
    completedMatches: {},    // 🏆 फ्युचरसाठी: संपलेले सामने (History)
    tournaments: {},         // 🏟️ फ्युचरसाठी: सर्व स्पर्धांचा डेटा
    playersStats: {}         // 🏃 फ्युचरसाठी: प्लेअर्सचे लाईव्ह आकडे
};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    // =================================================================
    // १. होम पेज कनेक्ट झाल्यावर: चालू सामन्यांची ताजी यादी मागणे (Onload)
    // =================================================================
    socket.on("request_all_active_matches", () => {
        const currentLiveList = Object.values(globalAppData.activeMatches);
        console.log(`📡 युझर ${socket.id} ला एकूण ${currentLiveList.length} चालू सामने पाठवले.`);
        
        // मागणी करणाऱ्या युझरला ताजी लिस्ट देणे
        socket.emit("live_matches_update", currentLiveList);
    });

    // =================================================================
    // २. स्कोअरर पॅनेल इव्हेंट: सामना सुरू करणे किंवा स्कोअर अपडेट करणे
    // =================================================================
    socket.on('match_status_changed_or_updated', (matchData) => {
        if (!matchData) {
            console.log("🚨 [Server]: आलेला मॅच डेटा पूर्णपणे रिकामी आहे!");
            return;
        }

        // फायरबेस स्क्रीनशॉटच्या रचनेनुसार आयडी पकडणे
        const mId = matchData.mId || matchData.matchId || "M_UNKNOWN";
        
        // 🔥 फिक्स: अक्षरे लहान असो वा मोठी (Live, 1st_Half_End), घोळ मिटवण्यासाठी lowercase केले
        const currentStatus = matchData.status ? matchData.status.trim().toLowerCase() : "";

        console.log(`📡 [Server Incoming]: डेटा धडकला! Status: ${matchData.status} | Match ID: ${mId}`);

        // 🎯 मॅच लाईव्ह किंवा हाफ-टाइमच्या कोणत्याही फॉरमॅटमध्ये असेल तर मेमरीत ठेवणे
        if (
            currentStatus === "live" || 
            currentStatus === "started" || 
            currentStatus === "1st_half_end" || 
            currentStatus === "half time" || 
            currentStatus === "half_time"
        ) {
            
            // 🎨 तुझ्या फायरबेस स्क्रीनशॉटमधील अचूक कीज (Keys) चे १-टू-१ सुरक्षित मॅपिंग
            globalAppData.activeMatches[mId] = {
                matchId: mId,
                tournamentId: matchData.tId || matchData.tournamentId || "",
                round: matchData.round || matchData.roundName || "Round 1",
                teamA: matchData.teamAName || matchData.teamA || "Team A",
                teamB: matchData.teamBName || matchData.teamB || "Team B",
                scoreA: matchData.scoreA !== undefined ? Number(matchData.scoreA) : 0,
                scoreB: matchData.scoreB !== undefined ? Number(matchData.scoreB) : 0,
                status: matchData.status || "Live", // मूळ स्टेटस जशी आहे तशी ठेवली (उदा. "1st_Half_End")
                lastRaid: matchData.lastRaid || null
            };
            console.log(`✅ [Memory Success]: मॅच ${mId} सर्व्हर मेमरीमध्ये लॉक झाली.`);

        } else if (currentStatus === "completed" || currentStatus === "finished") {
            // सामना संपला असेल तर लाईव्हमधून काढून इतिहासामध्ये ढकलणे
            globalAppData.completedMatches[mId] = matchData;
            delete globalAppData.activeMatches[mId];
            console.log(`🗑️ मॅच ${mId} संपल्यामुळे मेमरीमधून काढली.`);
        }

        // 📢 पूर्ण गावाला (सर्व प्रेक्षकांना) नवीन ताजी यादी ब्रॉडकास्ट करणे
        const finalLiveList = Object.values(globalAppData.activeMatches);
        console.log(`📢 [Broadcast]: एकूण ${finalLiveList.length} सामने हवेत सोडले.`);
        io.emit("live_matches_update", finalLiveList);
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
