// Backend URL - Render'da deploy edildikten sonra güncellenecek
const BACKEND_URL = 'https://dugun-anilari-backend.onrender.com';

// DOM elementleri
const uploadForm = document.getElementById('uploadForm');
const photoCaptureBtn = document.getElementById('photoCaptureBtn');
const audioCaptureBtn = document.getElementById('audioCaptureBtn');
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

// Önizleme göster
function showPreview() {
    if (capturedFileType === 'photo') {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(capturedFile);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '10px';
        
        previewContent.innerHTML = '';
        previewContent.appendChild(img);
    } else if (capturedFileType === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(capturedFile);
        audio.style.width = '100%';
        audio.style.margin = '10px 0';
        
        previewContent.innerHTML = '';
        previewContent.appendChild(audio);
    }
    
    submitBtn.style.display = 'block';
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

    // Sadece fotoğraf türündeki anıları filtrele
    const photoMemories = memories.filter(memory => memory.fileType === 'photo');

    if (photoMemories.length === 0) {
        gallery.innerHTML = '<div class="loading">Henüz fotoğraf paylaşılmamış. İlk fotoğrafı siz paylaşın!</div>';
        return;
    }

    gallery.innerHTML = photoMemories.map(memory => `
        <div class="memory-card">
            <div class="memory-content">
                <div class="memory-header">
                    <span class="memory-name">${escapeHtml(memory.name)}</span>
                    <span class="memory-date">${formatDate(memory.createdAt)}</span>
                </div>
                ${memory.message ? `<div class="memory-message">${escapeHtml(memory.message)}</div>` : ''}
                <iframe src="${memory.fileUrl}" width="100%" height="300" frameborder="0" style="border-radius: 8px;"></iframe>
            </div>
        </div>
    `).join('');
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
    
    // Her 30 saniyede bir anıları yenile
    setInterval(loadMemories, 30000);
});

// Modal dışına tıklandığında kapat
successModal.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
}); 