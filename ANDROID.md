# TugLife FM — Android via Capacitor

Este branch prepara o PWA para ser empacotado como app Android.

## Passos no Cursor ou terminal

```bash
git checkout android-capacitor
npm install
npx cap add android
npx cap sync
npx cap open android
```

Depois abra o projeto no Android Studio e gere o APK ou AAB.

### Package name
`com.tuglife.fm`

### Nome do app
TugLife FM

O webDir está apontando para a raiz (`.`) porque o `index.html` fica na raiz do repositório.

## Notas
- O PWA já tem `manifest.webmanifest` e service worker.
- Capacitor vai copiar os arquivos web para o projeto Android.
- Teste o streaming de áudio e o modo background depois do build.
