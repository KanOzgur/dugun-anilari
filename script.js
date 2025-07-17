// Backend URL - Render'da deploy edildikten sonra güncellenecek
const BACKEND_URL = 'https://dugun-anilari-backend.onrender.com';

// DOM elementleri
const uploadForm = document.getElementById('uploadForm');
const photoCaptureBtn = document.getElementById('photoCaptureBtn');
const audioCaptureBtn = document.getElementById('audioCaptureBtn');
const photoUploadBtn = document.getElementById('photoUploadBtn');
const audioUploadBtn = document.getElementById('audioUploadBtn');
const photoFileInput = document.getElementById('photoFileInput');
const audioFileInput = document.getElementById('audioFileInput');
const capturePreview = document.getElementById('capturePreview');
const previewContent = document.getElementById('previewContent');
const retakeBtn = document.getElementById('retakeBtn');
const submitBtn = document.getElementById('submitBtn');
const gallery = document.getElementById('gallery');
const successModal = document.getElementById('successModal');

// Global değişkenler
let capturedFile = null;
let capturedFileType = null;
let mediaStream = null;

// Anlık fotoğraf çekme
photoCaptureBtn.addEventListener('click', async function() {
    try {
        photoCaptureBtn.disabled = true;
        photoCaptureBtn.textContent = '📸 Kamera Açılıyor...';
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        
        mediaStream = stream;
        
        // Video element oluştur
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.style.width = '100%';
        video.style.borderRadius = '10px';
        
        previewContent.innerHTML = '';
        previewContent.appendChild(video);
        
        // Fotoğraf çek butonu ekle
        const captureBtn = document.createElement('button');
        captureBtn.textContent = '📸 Fotoğraf Çek';
        captureBtn.className = 'capture-btn photo-btn';
        captureBtn.style.marginTop = '10px';
        
        captureBtn.addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            
            canvas.toBlob(blob => {
                capturedFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                capturedFileType = 'photo';
                
                // Video'yu kapat
                stream.getTracks().forEach(track => track.stop());
                mediaStream = null;
                
                // Önizleme göster
                showPreview();
            }, 'image/jpeg', 0.8);
        });
        
        previewContent.appendChild(captureBtn);
        capturePreview.style.display = 'block';
        
    } catch (error) {
        console.error('Kamera hatası:', error);
        alert('Kameraya erişim izni gerekli!');
        photoCaptureBtn.disabled = false;
        photoCaptureBtn.textContent = '📸 Anlık Fotoğraf Çek';
    }
});

// Anlık ses kaydetme
audioCaptureBtn.addEventListener('click', async function() {
    try {
        audioCaptureBtn.disabled = true;
        audioCaptureBtn.textContent = '🎤 Mikrofon Açılıyor...';
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        mediaStream = stream;
        
        // Ses kayıt arayüzü
        previewContent.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 2rem; margin-bottom: 10px;">🎤</div>
                <p>Mikrofon hazır! Kayıt başlatmak için tıklayın.</p>
                <button id="startRecordingBtn" class="capture-btn audio-btn" style="margin: 10px;">
                    🎙️ Kayıt Başlat
                </button>
            </div>
        `;
        
        capturePreview.style.display = 'block';
        
        let mediaRecorder = null;
        let audioChunks = [];
        
        document.getElementById('startRecordingBtn').addEventListener('click', function() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                // Kaydı durdur
                mediaRecorder.stop();
                this.textContent = '🎙️ Kayıt Başlat';
                this.style.background = '#764ba2';
            } else {
                // Kaydı başlat
                audioChunks = [];
                mediaRecorder = new MediaRecorder(stream);
                
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    capturedFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
                    capturedFileType = 'audio';
                    
                    // Stream'i kapat
                    stream.getTracks().forEach(track => track.stop());
                    mediaStream = null;
                    
                    // Önizleme göster
                    showPreview();
                };
                
                mediaRecorder.start();
                this.textContent = '⏹️ Kaydı Durdur';
                this.style.background = '#ff6b6b';
            }
        });
        
    } catch (error) {
        console.error('Mikrofon hatası:', error);
        alert('Mikrofona erişim izni gerekli!');
        audioCaptureBtn.disabled = false;
        audioCaptureBtn.textContent = '🎤 Anlık Ses Kaydet';
    }
});

// Fotoğraf dosyası yükleme
photoUploadBtn.addEventListener('click', function() {
    photoFileInput.click();
});

photoFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.type.startsWith('image/')) {
            capturedFile = file;
            capturedFileType = 'photo';
            showPreview();
        } else {
            alert('Lütfen geçerli bir fotoğraf dosyası seçin!');
        }
    }
});

// Ses dosyası yükleme
audioUploadBtn.addEventListener('click', function() {
    audioFileInput.click();
});

audioFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.type.startsWith('audio/')) {
            capturedFile = file;
            capturedFileType = 'audio';
            showPreview();
        } else {
            alert('Lütfen geçerli bir ses dosyası seçin!');
        }
    }
});

// Önizleme göster
function showPreview() {
    // capturePreviewı görünür yap
    capturePreview.style.display = 'block';
    
    // Dosya bilgilerini hesapla
    const fileSize = (capturedFile.size / 1024 / 1024).toFixed(2); // MB
    const fileName = capturedFile.name;
    const fileType = capturedFileType === 'photo' ? 'Fotoğraf' : 'Ses Dosyası';
    
    // Önizleme container'ı oluştur
    const previewContainer = document.createElement('div');
    previewContainer.className = 'preview-container';
    previewContainer.style.cssText = `
        border: 2px solid #667eea;
        border-radius: 15px;
        padding: 20px;
        background: rgba(102, 126, 234, 0.05);
        margin: 15px 0;
    `;
    
    // Dosya bilgileri header'ı
    const fileInfo = document.createElement('div');
    fileInfo.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    `;
    
    const fileDetails = document.createElement('div');
    fileDetails.innerHTML = `
        <div style="font-weight: 600; color: #667eea; margin-bottom: 5px;">${fileType}</div>
        <div style="font-size: 0.9rem; color: #666;">${fileName}</div>
        <div style="font-size: 0.8rem; color: #888;">${fileSize} MB</div>
    `;
    
    // Silme butonu
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️ Sil';
    deleteBtn.style.cssText = `
        background: #ff6b6b;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.3s ease;
    `;
    
    deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = '#ff5252';
        deleteBtn.style.transform = 'scale(1.05)';
    });
    
    deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = '#ff6b6b';
        deleteBtn.style.transform = 'scale(1)';
    });
    
    deleteBtn.addEventListener('click', () => {
        // Dosyayı sil
        capturedFile = null;
        capturedFileType = null;
        capturePreview.style.display = 'none';
        submitBtn.style.display = 'none';
        
        // Dosya input'larını temizle
        photoFileInput.value = '';
        audioFileInput.value = '';
        
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
    });
    
    fileInfo.appendChild(fileDetails);
    fileInfo.appendChild(deleteBtn);
    previewContainer.appendChild(fileInfo);
    
    // Medya önizlemesi
    const mediaPreview = document.createElement('div');
    mediaPreview.style.cssText = `
        text-align: center;
        margin-top: 15px;
    `;
    
    if (capturedFileType === 'photo') {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(capturedFile);
        img.style.cssText = `
            max-width: 100%;
            max-height: 300px;
            object-fit: cover;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        `;
        mediaPreview.appendChild(img);
    } else if (capturedFileType === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(capturedFile);
        audio.style.cssText = `
            width: 100%;
            margin: 10px 0;
            border-radius: 10px;
        `;
        mediaPreview.appendChild(audio);
    }
    
    previewContainer.appendChild(mediaPreview);
    
    // Önizleme alanını temizle ve yeni içeriği ekle
    previewContent.innerHTML = '';
    previewContent.appendChild(previewContainer);
    
    // Submit butonunu göster
    submitBtn.style.display = 'block';
    
    // Capture butonlarını reset et
    photoCaptureBtn.disabled = false;
    photoCaptureBtn.textContent = '📸 Anlık Fotoğraf Çek';
    audioCaptureBtn.disabled = false;
    audioCaptureBtn.textContent = '🎤 Anlık Ses Kaydet';
}

// Yeniden çek
retakeBtn.addEventListener('click', function() {
    capturedFile = null;
    capturedFileType = null;
    capturePreview.style.display = 'none';
    submitBtn.style.display = 'none';
    
    // Dosya input'larını temizle
    photoFileInput.value = '';
    audioFileInput.value = '';
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
});

// Form gönderimi
uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!capturedFile) {
        alert('Lütfen önce fotoğraf çekin veya ses kaydedin!');
        return;
    }

    const formData = new FormData();
    formData.append('name', document.getElementById('name').value);
    formData.append('message', document.getElementById('message').value);
    formData.append('fileType', capturedFileType);
    formData.append('file', capturedFile);

    const submitBtnElement = document.querySelector('.submit-btn');
    const btnText = submitBtnElement.querySelector('.btn-text');
    const btnLoading = submitBtnElement.querySelector('.btn-loading');

    // Loading durumu
    submitBtnElement.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    try {
        const response = await fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showSuccessModal();
            uploadForm.reset();
            capturePreview.style.display = 'none';
            submitBtn.style.display = 'none';
            capturedFile = null;
            capturedFileType = null;
            
            // Dosya input'larını temizle
            photoFileInput.value = '';
            audioFileInput.value = '';
            
            loadMemories(); // Galeriyi yenile
        } else {
            const error = await response.text();
            alert('Hata: ' + error);
        }
    } catch (error) {
        console.error('Hata:', error);
        alert('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        // Loading durumunu kaldır
        submitBtnElement.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
});

// Başarı modalını göster
function showSuccessModal() {
    successModal.style.display = 'flex';
}

// Modal'ı kapat
function closeModal() {
    successModal.style.display = 'none';
}

// Anıları yükle
async function loadMemories() {
    try {
        const response = await fetch(`${BACKEND_URL}/memories`);
        if (response.ok) {
            const memories = await response.json();
            displayMemories(memories);
        } else {
            gallery.innerHTML = '<div class="loading">Anılar yüklenirken hata oluştu.</div>';
        }
    } catch (error) {
        console.error('Anılar yüklenirken hata:', error);
        gallery.innerHTML = '<div class="loading">Anılar yüklenirken hata oluştu.</div>';
    }
}

// Anıları görüntüle
function displayMemories(memories) {
    if (memories.length === 0) {
        gallery.innerHTML = '<div class="loading">Henüz anı paylaşılmamış. İlk anıyı siz paylaşın!</div>';
        return;
    }

    // Fotoğraf ve ses dosyalarını ayrı ayrı filtrele
    const photoMemories = memories.filter(memory => memory.fileType === 'photo');
    const audioMemories = memories.filter(memory => memory.fileType === 'audio');

    // Galeri içeriğini oluştur
    let galleryContent = '';

    // Fotoğraflar bölümü
    if (photoMemories.length > 0) {
        galleryContent += `
            <div class="memories-section">
                <h3 class="section-title">📸 Fotoğraflar</h3>
                <div class="memories-grid">
                    ${photoMemories.map(memory => `
                        <div class="memory-card">
                            <div class="memory-content">
                                <div class="memory-header">
                                    <span class="memory-name">${escapeHtml(memory.name)}</span>
                                    <span class="memory-date">${formatDate(memory.createdAt)}</span>
                                </div>
                                ${memory.message ? `<div class="memory-message">${escapeHtml(memory.message)}</div>` : ''}
                                <div class="media-preview">
                                    <img src="https://drive.google.com/thumbnail?id=${memory.id}&sz=w400" 
                                         alt="${escapeHtml(memory.name)}" 
                                         style="width:100ght: 200 object-fit: cover; border-radius: 8px; cursor: pointer;"
                                         onclick="window.open('${memory.fileUrl}', '_blank')"
                                         onerror="this.src='data:image/svg+xml;base64PHN2ZyB3aWR0D0NDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly933udzMub3JnLzIwMDAvc3ZnIj48mVjdCB3WR0aD0MTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8PHRleHQgeD0NTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2ucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0Izk5OSIgdGV4C1hbmNob3I9Im1ZGRsZSIgZHk9Ii4zZW0iPkZvdG8gVW5hdmFpbGFibGU8RleHQ+PC9zdmc+'">
                                    <div class="media-overlay">
                                        <button class="view-btn" onclick="window.open('${memory.fileUrl}', '_blank')">
                                            👁️ Görüntüle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Ses dosyaları bölümü
    if (audioMemories.length > 0) {
        galleryContent += `
            <div class="memories-section">
                <h3 class="section-title">🎵 Ses Dosyaları</h3>
                <div class="memories-grid">
                    ${audioMemories.map(memory => `
                        <div class="memory-card audio-card">
                            <div class="memory-content">
                                <div class="memory-header">
                                    <span class="memory-name">${escapeHtml(memory.name)}</span>
                                    <span class="memory-date">${formatDate(memory.createdAt)}</span>
                                </div>
                                ${memory.message ? `<div class="memory-message">${escapeHtml(memory.message)}</div>` : ''}
                                <div class="audio-preview">
                                    <div class="audio-icon">🎵</div>
                                    <div class="audio-info">
                                        <div class="audio-name">${escapeHtml(memory.name)}</div>
                                        <button class="play-btn" onclick="window.open('${memory.fileUrl}', '_blank')">
                                            ▶️ Dinle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Eğer hiç dosya yoksa
    if (photoMemories.length === 0 && audioMemories.length === 0) {
        galleryContent = '<div class="loading">Henüz dosya paylaşılmamış. İlk dosyayı siz paylaşın!</div>';
    }

    gallery.innerHTML = galleryContent;
}

// HTML escape fonksiyonu
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Tarih formatla
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Sayfa yüklendiğinde anıları yükle
document.addEventListener('DOMContentLoaded', function() {
    loadMemories();
    
    // Her 30niyede bir anıları yenile
    setInterval(loadMemories, 30000);
});

// Modal dışına tıklandığında kapat
successModal.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
}); 