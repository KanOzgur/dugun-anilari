const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Drive API setup
let auth;
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Environment variable'dan JSON string olarak oku
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
    } else {
        // Dosyadan oku (development için)
        auth = new google.auth.GoogleAuth({
            keyFile: './credentials.json',
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
    }
} catch (error) {
    console.error('Google Drive API yapılandırma hatası:', error);
    auth = null;
}

const drive = auth ? google.drive({ version: 'v3', auth }) : null;

// In-memory storage for memories (production'da database kullanılmalı)
let memories = [];

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece resim ve ses dosyaları kabul edilir!'), false);
        }
    }
});

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Düğün Anıları API', status: 'running' });
});

// Anıları getir
app.get('/memories', (req, res) => {
    try {
        res.json(memories);
    } catch (error) {
        console.error('Anılar getirilirken hata:', error);
        res.status(500).json({ error: 'Anılar yüklenirken hata oluştu' });
    }
});

// Dosya yükle ve Google Drive'a kaydet
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { name, message, fileType } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Dosya gerekli' });
        }

        if (!name) {
            return res.status(400).json({ error: 'İsim gerekli' });
        }

        if (!drive) {
            return res.status(500).json({ error: 'Google Drive API yapılandırılmamış' });
        }

        // Google Drive'a dosya yükle
        const fileId = await uploadToGoogleDrive(file, fileType);
        const fileUrl = `https://drive.google.com/uc?id=${fileId}`;

        // Memory objesi oluştur
        const memory = {
            id: uuidv4(),
            name: name,
            message: message || '',
            fileType: fileType,
            fileUrl: fileUrl,
            createdAt: new Date().toISOString()
        };

        // Memory'yi listeye ekle
        memories.unshift(memory);

        res.json({ 
            message: 'Anı başarıyla paylaşıldı',
            memory: memory
        });

    } catch (error) {
        console.error('Dosya yüklenirken hata:', error);
        res.status(500).json({ error: 'Dosya yüklenirken hata oluştu: ' + error.message });
    }
});

// Google Drive'a dosya yükleme fonksiyonu
async function uploadToGoogleDrive(file, fileType) {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        
        if (!folderId) {
            throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable ayarlanmamış');
        }

        const fileMetadata = {
            name: `${fileType}_${Date.now()}_${file.originalname}`,
            parents: [folderId],
        };

        const media = {
            mimeType: file.mimetype,
            body: require('stream').Readable.from(file.buffer)
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id'
        });

        console.log('Dosya Google Drive\'a yüklendi:', response.data.id);
        return response.data.id;
    } catch (error) {
        console.error('Google Drive yükleme hatası:', error);
        throw new Error('Google Drive\'a yükleme başarısız: ' + error.message);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
    console.log(`API: http://localhost:${PORT}`);
    console.log(`Google Drive API: ${drive ? 'Aktif' : 'Devre dışı'}`);
    console.log(`Folder ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID || 'Ayarlanmamış'}`);
}); 