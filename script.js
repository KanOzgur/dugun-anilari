// Backend URL - Render'da deploy edildikten sonra güncellenecek
const BACKEND_URL = 'https://dugun-anilari-backend.onrender.com';

// DOM elementleri
const uploadForm = document.getElementById('uploadForm');
const fileTypeSelect = document.getElementById('fileType');
const fileInputGroup = document.getElementById('fileInputGroup');
const fileInput = document.getElementById('file');
const filePreview = document.getElementById('filePreview');
const gallery = document.getElementById('gallery');
const successModal = document.getElementById('successModal');

// Dosya türü seçimi değiştiğinde
fileTypeSelect.addEventListener('change', function() {
    if (this.value) {
        fileInputGroup.style.display = 'block';
        fileInput.accept = this.value === 'photo' ? 'image/*' : 'audio/*';
    } else {
        fileInputGroup.style.display = 'none';
        filePreview.innerHTML = '';
    }
});

// Dosya seçildiğinde önizleme
fileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;

    filePreview.innerHTML = '';

    if (fileTypeSelect.value === 'photo') {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px';
        img.style.objectFit = 'cover';
        filePreview.appendChild(img);
    } else if (fileTypeSelect.value === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(file);
        filePreview.appendChild(audio);
    }
});

// Form gönderimi
uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', document.getElementById('name').value);
    formData.append('message', document.getElementById('message').value);
    formData.append('fileType', fileTypeSelect.value);
    formData.append('file', fileInput.files[0]);

    const submitBtn = document.querySelector('.submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Loading durumu
    submitBtn.disabled = true;
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
            fileInputGroup.style.display = 'none';
            filePreview.innerHTML = '';
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
        submitBtn.disabled = false;
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

    gallery.innerHTML = memories.map(memory => `
        <div class="memory-card">
            <div class="memory-content">
                <div class="memory-header">
                    <span class="memory-name">${escapeHtml(memory.name)}</span>
                    <span class="memory-date">${formatDate(memory.createdAt)}</span>
                </div>
                ${memory.message ? `<div class="memory-message">${escapeHtml(memory.message)}</div>` : ''}
                ${memory.fileType === 'photo' 
                    ? `<img src="${memory.fileUrl}" alt="Anı fotoğrafı" class="memory-media" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                       <div style="display:none; text-align:center; padding:20px; color:#666;">Fotoğraf yüklenemedi</div>`
                    : `<audio controls class="memory-media"><source src="${memory.fileUrl}" type="audio/mpeg">Tarayıcınız ses dosyasını desteklemiyor.</audio>`
                }
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