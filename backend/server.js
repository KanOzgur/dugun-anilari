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
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

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

        // Google Drive'a dosya yükle
        const fileId = await uploadToGoogleDrive(file, fileType);

        // Memory objesi oluştur
        const memory = {
            id: uuidv4(),
            name: name,
            message: message || '',
            fileType: fileType,
            fileUrl: `https://drive.google.com/uc?id=${fileId}`,
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
        res.status(500).json({ error: 'Dosya yüklenirken hata oluştu' });
    }
});

// Google Drive'a dosya yükleme fonksiyonu
async function uploadToGoogleDrive(file, fileType) {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        
        const fileMetadata = {
            name: `${fileType}_${Date.now()}_${file.originalname}`,
            parents: folderId ? [folderId] : undefined,
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

        return response.data.id;
    } catch (error) {
        console.error('Google Drive yükleme hatası:', error);
        throw new Error('Google Drive\'a yükleme başarısız');
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
    console.log(`API: http://localhost:${PORT}`);
}); 