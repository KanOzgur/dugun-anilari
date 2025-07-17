const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000
// Middleware
app.use(cors({
    origin: [
       'https://kanozgur.github.io',
       'https://kanozgur.github.io/dugun-anilari',
        'http://localhost:300',
        'http://localhost:5000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'ONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Drive API setup - Service Account kullan
let drive = null;

try {
    // Service Account credentials kontrolü
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable bulunamadı');    }
    
    let credentials;
    try {
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } catch (parseError) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS JSON formatında değil: ' + parseError.message);
    }

    // Gerekli alanları kontrol et
    if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Service Account credentials eksik: client_email veya private_key bulunamadı');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    drive = google.drive({ version: 'v3', auth: auth });
    console.log('Service Account ile Google Drive API başarıyla yapılandırıldı');
    console.log('Service Account Email:', credentials.client_email);
} catch (error) {
    console.error('Google Drive API yapılandırma hatası:', error.message);
    console.log('Lütfen Render dashboard\'da GOOGLE_APPLICATION_CREDENTIALS environment variable\'ını kontrol edin');
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10B limit
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

        // Google Drivedan dosyaları al
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id,name,createdTime,mimeType)',
            orderBy: 'createdTime desc',
            pageSize: 20
        });

        const files = response.data.files || [];
        
        // Dosyaları memory formatına çevir
        const driveMemories = files.map(file => {
            // Dosya adından bilgileri çıkar (format: photo_1234567890e.jpg)
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

        // Sadece son 10ayı döndür
        const recentMemories = driveMemories.slice(0, 10);
        res.json(recentMemories);

    } catch (error) {
        console.error('Anılar getirilirken hata:', error);
        res.status(500).json({ error: 'Anılar yüklenirken hata oluştu: ' + error.message });
    }
});

// Dosya yükle ve Google Driveakaydet
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

        // Dosyayı public yap
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
    // Google Drive'ın yeni embed formatı
    const timestamp = Date.now();
    return `https://drive.google.com/file/d/${fileId}/preview?usp=sharing&t=${timestamp}`;
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
    console.log(`Google Drive API: ${drive ? 'Service Account Aktif' : 'Devre dışı'}`);
    console.log(`Folder ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID || 'Ayarlanmamış'}`);
}); 