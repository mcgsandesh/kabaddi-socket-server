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

// 🧠 प्युअर सर्व्हर मेमरी कप्पा
let globalAppData = {
    activeMatches: {},       
    completedMatches: {}
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
        
        socket.emit("live_matches_update", currentLiveList);
    });

    // =================================================================
    // २. स्कोअरर पॅनेल इव्हेंट: Tournament ID + Match ID कॉम्बिनेशनसह लॉक
    // =================================================================
    socket.on('match_status_changed_or_updated', (matchData) => {
        console.log("\n📥 [SERVER RECEIVE]: स्कोअरर पॅनेलवरून डेटा सर्व्हरला मिळाला!");
        
        if (!matchData) {
            console.log("🚨 [SERVER VALIDATION ERROR]: स्कोअररकडून आलेला डेटा पूर्णपणे रिकामा (null) आहे!");
            return;
        }

        console.log("📦 आलेला कच्चा डेटा (Raw Payload):", JSON.stringify(matchData, null, 2));

        const incomingId = matchData.matchId || matchData.mId || matchData.id;
        const incomingTourId = matchData.tournamentId || matchData.tId;
        const statusCheck = matchData.status ? matchData.status.trim() : "Live";

        console.log(`🆔 [ID TRACE] -> Match ID: "${incomingId}" | Tournament ID: "${incomingTourId}" | Status: "${statusCheck}"`);

        if (!incomingId) {
            console.log("🚨 [SERVER DROP ERROR]: डेटामध्ये कोणताही वैध ID सापडला नाही! पॅलोड ड्रॉप केला.");
            return;
        }

        // 🎯 [COMBINED UNIQUE KEY]: टूर्नामेंट आयडी आणि मॅच आयडी एकत्र करून युनिक की बनवणे
        const combinedKey = incomingTourId ? `${incomingTourId}_${incomingId}` : incomingId;
        console.log(`🔑 [GENERATED KEY]: सर्व्हर मेमरीसाठी तयार झालेली युनिक की: "${combinedKey}"`);

        // 🎯 अधिकृत स्टेटस "Live" आणि "1st_Half_End" चे अचूक केसेस तपासणे
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
                lastRaid: matchData.lastRaid || null
            };
            
            console.log(`💾 [RAM SAVE SUCCESS]: युनिक कप्प्यात मॅच लॉक झाली -> की: ${combinedKey}`);
            console.log("📊 मेमरीमधील ताजी मॅच स्थिती:", JSON.stringify(globalAppData.activeMatches[combinedKey], null, 2));

        } else if (
            statusCheck.toLowerCase() === "completed" || 
            statusCheck.toLowerCase() === "finished"
        ) {
            if (!globalAppData.completedMatches) globalAppData.completedMatches = {};
            globalAppData.completedMatches[combinedKey] = matchData;
            
            // लाईव्ह कप्प्यामधून कम्बाईन की उडवणे
            delete globalAppData.activeMatches[combinedKey];
            console.log(`🗑️ [SERVER MEMORY REMOVE]: मॅच "${incomingId}" (Key: ${combinedKey}) संपल्यामुळे लाईव्ह कप्प्यामधून डिलीट केली.`);
        }

        // 📢 संपूर्ण इंटरनेटवरील सर्व होम पेजेसना न मागता डेटा ब्रॉडकास्ट करणे
        const finalLiveList = Object.values(globalAppData.activeMatches);
        console.log(`📢 [SERVER BROADCAST SENT]: सर्व होम पेजेसना एकूण ${finalLiveList.length} सामने रवाना केले.`);
        io.emit("live_matches_update", finalLiveList);
    });

    socket.on('disconnect', () => {
        console.log(`❌ युझर डिस्कनेक्ट झाला: ${socket.id}`);
    });
}); // 🎯 [FIX]: हा io.on चा शेवटचा कंस एकदम परफेक्ट मॅच केला!

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 कबड्डी सॉकेट सर्व्हर पोर्ट ${PORT} वर जिवंत झाला आहे!`);
});
