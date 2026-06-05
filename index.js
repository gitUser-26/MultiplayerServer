// index.js
const { WebSocketServer } = require('ws');

// Menggunakan port dari lingkungan hosting (Render/Glitch) atau port 3000 jika dijalankan lokal
const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

// Map untuk menyimpan daftar koneksi HP pemain yang aktif
const clients = new Map();

console.log(`Signaling Server WebRTC berjalan di port: ${PORT}`);

wss.on('connection', (ws) => {
    // Membuat ID acak unik untuk HP yang baru terhubung (ID di atas 1)
    // Karena ID 1 biasanya dipesan secara khusus untuk HOST di Godot 4
    const peerId = Math.floor(Math.random() * 1000000) + 2; 
    clients.set(peerId, ws);
    
    console.log(`[TERHUBUNG] HP Baru masuk. Diberi ID: ${peerId}`);
    
    // LANGKAH 1: Beritahu HP tersebut berapa ID unik mereka
    ws.send(JSON.stringify({ 
        type: "registrasi", 
        id: peerId 
    }));

    // Menangani pesan sinyal yang dikirim oleh HP pemain
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // Selipkan ID pengirim ke dalam data agar si penerima tahu asal isyarat ini
            data.sender_id = peerId;

            // LANGKAH 2: Logika Penerusan Sinyal
            if (data.target_id && clients.has(data.target_id)) {
                // Jika isyarat memiliki target spesifik (misal: Client kirim Offer ke Host)
                const targetClient = clients.get(data.target_id);
                targetClient.send(JSON.stringify(data));
            } else {
                // Jika tidak ada target spesifik, kirim (broadcast) ke semua HP yang online
                // Berguna saat Client baru mencari tahu siapa saja yang sedang membuka Room
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === 1) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        } catch (error) {
            console.error("Gagal membaca data sinyal:", error);
        }
    });

    // LANGKAH 3: Menangani jika pemain keluar game atau kehilangan sinyal mobile data
    ws.on('close', () => {
        clients.delete(peerId);
        console.log(`[TERPUTUS] Pemain ID ${peerId} keluar.`);
        
        // Informasikan ke seluruh HP lain bahwa ID ini sudah tidak aktif
        wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({ 
                    type: "peer_disconnect", 
                    sender_id: peerId 
                }));
            }
        });
    });
    
    // Menangani error pada koneksi websocket agar server tidak mendadak crash
    ws.on('error', (err) => {
        console.error(`Error pada koneksi ID ${peerId}:`, err);
    });
});
