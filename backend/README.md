# Düğün Anıları Backend

Express.js tabanlı backend API'si.

## Kurulum

1. Dependencies yükleyin:
```bash
npm install
```

2. Environment variables ayarlayın:
```bash
cp env.example .env
```

3. Google Drive API credentials dosyasını `credentials.json` olarak ekleyin.

4. Google Drive folder ID'sini `.env` dosyasında ayarlayın.

## Çalıştırma

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

- `GET /` - API durumu
- `GET /memories` - Tüm anıları getir
- `POST /upload` - Yeni anı yükle

## Google Drive Setup

1. Google Cloud Console'da proje oluşturun
2. Google Drive API'yi etkinleştirin
3. Service Account oluşturun
4. JSON credentials dosyasını indirin
5. Google Drive'da folder oluşturun ve ID'sini alın 