const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: [
        'https://kanozgur.github.io',
        'https://kanozgur.github.io/dugun-anilari',
        'http://localhost:3000',
        'http://localhost:5000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Drive API setup - OAuth2 kullan
let oauth2Client;
let drive = null;

try {
    // OAuth2 credentials
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    // Access token varsa kullan
    if (process.env.GOOGLE_ACCESS_TOKEN) {
        oauth2Client.setCredentials({
            access_token: process.env.GOOGLE_ACCESS_TOKEN
        });
        drive = google.drive({ version: 'v3', auth: oauth2Client });
        console.log('OAuth2 ile Google Drive API başarıyla yapılandırıldı');
    } else {
        console.log('OAuth2 access token bulunamadı');
    }
} catch (error) {
    console.error('Google Drive API yapılandırma hatası:', error);
}

// OAuth2 callback endpoint
app.get('/oauth2callback', async (req, res) => {
    try {
        const { code } = req.query;
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        console.log('OAuth2 token alındı:', tokens.access_token);
        
        // Token'ı environment variable olarak kaydet (geçici çözüm)
        process.env.GOOGLE_ACCESS_TOKEN = tokens.access_token;
        
        res.json({ 
            message: 'OAuth2 başarıyla yapılandırıldı',
            access_token: tokens.access_token 
        });
    } catch (error) {
        console.error('OAuth2 callback hatası:', error);
        res.status(500).json({ error: 'OAuth2 yapılandırma hatası' });
    }
});

// OAuth2 authorization URL
app.get('/auth', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file']
    });
    res.json({ authUrl });
});

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
app.get('/memories', async (req, res) => {
    try {
        if (!drive) {
            return res.status(500).json({ error: 'Google Drive API yapılandırılmamış' });
        }

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            return res.status(500).json({ error: 'Google Drive folder ID ayarlanmamış' });
        }

        // Google Drive'dan dosyaları al
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id,name,createdTime,mimeType)',
            orderBy: 'createdTime desc',
            pageSize: 20 // Son 20 dosya
        });

        const files = response.data.files || [];
        
        // Dosyaları memory formatına çevir
        const driveMemories = files.map(file => {
            // Dosya adından bilgileri çıkar (format: photo_1234567890_filename.jpg)
            const nameParts = file.name.split('_');
            const fileType = nameParts[0]; // photo veya audio
            const timestamp = nameParts[1];
            const originalName = nameParts.slice(2).join('_');
            
            return {
                id: file.id,
                name: originalName || 'Bilinmeyen',
                message: '', // Drive'da mesaj saklamıyoruz
                fileType: fileType,
                fileUrl: getFileUrl(file.id),
                createdAt: file.createdTime
            };
        });

        // Sadece son 10 dosyayı döndür
        const recentMemories = driveMemories.slice(0, 10);
        res.json(recentMemories);

    } catch (error) {
        console.error('Anılar getirilirken hata:', error);
        res.status(500).json({ error: 'Anılar yüklenirken hata oluştu: ' + error.message });
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
            return res.status(500).json({ error: 'Google Drive API yapılandırılmamış. OAuth2 gerekli.' });
        }

        // Google Drive'a dosya yükle
        const fileId = await uploadToGoogleDrive(file, fileType, name);
        const fileUrl = getFileUrl(fileId);

        // Memory objesi oluştur (sadece response için)
        const memory = {
            id: fileId,
            name: name,
            message: message || '',
            fileType: fileType,
            fileUrl: fileUrl,
            createdAt: new Date().toISOString()
        };

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
async function uploadToGoogleDrive(file, fileType, originalName) {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        
        if (!folderId) {
            throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable ayarlanmamış');
        }

        // Dosya metadata'sı
        const fileMetadata = {
            name: `${fileType}_${Date.now()}_${originalName}`,
            parents: [folderId],
        };

        // Media configuration
        const media = {
            mimeType: file.mimetype,
            body: require('stream').Readable.from(file.buffer)
        };

        // Dosyayı yükle
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id'
        });

        const fileId = response.data.id;
        console.log('Dosya Google Drive\'a yüklendi:', fileId);

        // Dosyayı public yap - daha güvenilir yöntem
        try {
            await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
            console.log('Dosya public yapıldı:', fileId);
        } catch (permError) {
            console.error('Permission hatası:', permError);
            // Permission hatası olsa bile devam et
        }

        return fileId;
    } catch (error) {
        console.error('Google Drive yükleme hatası:', error);
        throw new Error('Google Drive\'a yükleme başarısız: ' + error.message);
    }
}

// Dosya URL'sini oluştur
function getFileUrl(fileId) {
    // Cache-busting için timestamp ekle
    const timestamp = Date.now();
    return `https://drive.google.com/file/d/${fileId}/preview?t=${timestamp}`;
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
    console.log(`Google Drive API: ${drive ? 'OAuth2 Aktif' : 'Devre dışı'}`);
    console.log(`Folder ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID || 'Ayarlanmamış'}`);
}); 