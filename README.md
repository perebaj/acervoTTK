# Acervo do TTK

Galeria interativa de vídeos, áudios e fotos do Carlos (TTK) e sua caixa de 24 burdoguinhas, hospedada integralmente na Vercel com `Vercel Blob`.

## Como funciona a moderação e os áudios

- Qualquer visitante pode submeter vídeos, áudios ou fotos de até 50 MB sem precisar de cadastro.
- Áudios `.opus` / `.ogg` vindos do WhatsApp são transcodificados para `.mp3` ainda no navegador antes do upload para funcionarem nativamente no Safari (iOS) e Android.
- Novos envios caem em `pending/` (invisíveis na galeria pública) e disparam um e-mail via `Resend` para `NOTIFY_EMAIL` com um link assinado por HMAC (`/?review=<id>&token=<hmac>`).
- Ao aprovar pelo link, o item é promovido para `items/` e entra no site na hora; ao rejeitar, tanto o JSON pendente quanto o arquivo de mídia são removidos do `Vercel Blob`.

## Variáveis de ambiente na Vercel

- `BLOB_READ_WRITE_TOKEN`: preenchida automaticamente ao conectar a store do `Vercel Blob`.
- `APPROVAL_SECRET`: chave secreta (mínimo 16 caracteres) usada para assinar os links de aprovação.
- `NOTIFY_EMAIL`: endereço que recebe os pedidos de revisão (`perebaj@gmail.com`).
- `RESEND_API_KEY`: chave da API do Resend (`resend/resend-email` no Marketplace da Vercel) para entrega dos e-mails.
- `RESEND_FROM_EMAIL` *(opcional)*: remetente configurado no Resend (padrão `Acervo TTK <onboarding@resend.dev>`).
- `PUBLIC_SITE_URL` *(opcional)*: URL base fixa usada para montar o link de revisão enviado por e-mail.

## Comandos

```bash
npm test
npm run build
BLOB_READ_WRITE_TOKEN=... npm run seed
```
