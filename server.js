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

// 🧠 प्युअर सर्व्हर मेमरी (फायरबेस रीडचा खर्च = ०)
let globalAppData = {
    activeMatches: {},       
    completedMatches: {},    
    tournaments: {},         
    playersStats: {}         
};

io.on('connection', (socket) => {
    console.log(`🔌 नवीन युझर कनेक्ट झाला: ${socket.id}`);

    // =================================================================
    // १. होम पेज कनेक्ट झाल्यावर: मेमरी कप्प्यातील ताजी यादी देणे
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
        
        // 📢 फक्त मागणाऱ्या होम पेजला ताजी यादी देणे
        socket.emit("live_matches_update", currentLiveList);
    });

    // =================================================================
    // २. स्कोअरर/ॲडमिन पॅनेल इव्हेंट: "Live" आणि "1st_Half_End" चे कडक चेकिंग
    // =================================================================
    socket.on('match_status_changed_or_updated', (matchData) => {
        console.log("\n📥 [SERVER RECEIVE]: स्कोअरर पॅनेलवरून डेटा धडकला आहे...");
        
        if (!matchData) {
            console.log("🚨 [SERVER ERROR]: स्कोअररकडून आलेला डेटा पूर्णपणे रिकामा (null) आहे!");
            return;
        }

        // 🆔 [ID EXTRACTION LOGIC]
        const incomingId = matchData.matchId || matchData.mId || matchData.id;
        const incomingTourId = matchData.tournamentId || matchData.tId;
        
        // 🎯 डेटाबेसचे अधिकृत स्टेटस (Trim करून जसेच्या तसे तपासणे)
        const statusCheck = matchData.status ? matchData.status.trim() : "Live";

        console.log(`🆔 [ID TRACE] -> Match ID: "${incomingId}" | Tournament ID: "${incomingTourId}" | Status: "${statusCheck}"`);

        // जर आयडी सापडलाच नाही तर डेटा कप्प्यात न ठेवता इथेच ब्लॉक करणे
        if (!incomingId) {
            console.log("%c🚨 [CRITICAL DROP]: स्कोअररच्या डेटामध्ये कोणताही ID सापडला नाही! पॅलोड ड्रॉप केला.", "color: red; font-weight: bold;");
            return;
        }

        // 🎯 कडक कंडिशन मॅचिंग (डेटाबेसमधील "Live" आणि "1st_Half_End" अचूक केसेस तपासल्या)
        if (
            statusCheck === "Live" || 
            statusCheck === "live" || 
            statusCheck === "1st_Half_End" || 
            statusCheck === "1st_half_end" ||
            statusCheck === "half time" ||
            statusCheck === "half_time" ||
            statusCheck === "started"
        ) {
            
            // सर्व्हर मेमरीमध्ये आयडी गोंधळ मिटवून डेटा लॉक केला 🎯
            globalAppData.activeMatches[incomingId] = {
                matchId: incomingId,
                tournamentId: incomingTourId || "",
                round: matchData.round || matchData.roundName || "League Match",
                teamA: matchData.teamA || matchData.teamAName || "Team A",
                teamB: matchData.teamB || matchData.teamBName || "Team B",
                scoreA: matchData.scoreA !== undefined ? Number(matchData.scoreA) : 0,
                scoreB: matchData.scoreB !== undefined ? Number(matchData.scoreB) : 0,
                status: statusCheck, // अधिकृत स्टेटस जसाच्या तसा पुढे जाईल
                lastRaid: matchData.lastRaid || null
            };
            
            console.log(`✅ [SERVER MEMORY LOCK SUCCESS]: मॅच "${incomingId}" मेमरी कप्प्यात सुरक्षित बसली! -> (Score A: ${matchData.scoreA} | Score B: ${matchData.scoreB} | Status: ${statusCheck})`);
            console.log("📋 सध्या मेमरीमधील सर्व चालू मॅच IDs:", Object.keys(globalAppData.activeMatches));

        } else if (
            statusCheck.toLowerCase() === "completed" || 
            statusCheck.toLowerCase() === "finished"
        ) {
            globalAppData.completedMatches[incomingId] = matchData;
            delete globalAppData.activeMatches[incomingId];
            console.log(`🗑️ [SERVER MEMORY REMOVE]: मॅच "${incomingId}" संपल्यामुळे लाईव्ह कप्प्यामधून डिलीट केली.`);
        }

        // =============================================================
        // 📢 [CRITICAL BROADCAST]: संपूर्ण इंटरनेटवरील सर्व होम पेजेसना न मागता ताजा डेटा फेका!
        // =============================================================
        const finalLiveList = Object.values(globalAppData.activeMatches);
        io.emit("live_matches_update", finalLiveList);
        console.log(`📢 [Global Broadcast Sent]: एकूण ${finalLiveList.length} सामन्यांची ताजी यादी सर्व कनेक्टेड होम पेजेसना रवाना केली.`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ युझर डिस्कनेक्ट झाला: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 कबड्डी सॉकेट सर्व्हर पोर्ट ${PORT} वर जिवंत झाला आहे!`);
});
