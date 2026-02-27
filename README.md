# PontoApp SaaS — Multi-tenant

Versão multi-empresa do PontoApp com planos, convites e painel SuperAdmin.

## Arquitetura

- **Multi-tenant** via campo `companyId` em todos os documentos
- **Slug na URL**: cada empresa acessa `/nome-empresa/login`
- **3 níveis de acesso**: SuperAdmin · CompanyAdmin · User

## Configuração inicial

### 1. Firebase
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
# Preencha com as credenciais do seu projeto Firebase
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Deploy das regras e índices
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Criar o primeiro SuperAdmin
No Firebase Authentication, crie um usuário com e-mail/senha.
No Firestore, crie manualmente o documento `users/{uid}`:
```json
{
  "email": "seu@email.com",
  "displayName": "Super Admin",
  "role": "SuperAdmin",
  "status": "active",
  "companyId": "",
  "workHoursPerDay": 8,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 5. Acesse o painel SuperAdmin
```
https://seudominio.com/super/login
```

### 6. Crie um plano e uma empresa
No painel SuperAdmin:
1. Aba **Planos** → crie pelo menos um plano
2. Aba **Empresas** → crie a primeira empresa (o slug vira a URL)

### 7. Acesse a empresa
```
https://seudominio.com/nome-empresa/login
```
O primeiro usuário que se registrar na empresa vira **CompanyAdmin** automaticamente.

## Fluxo de usuários

### Auto-registro
`/empresa/register` → status `pending` → CompanyAdmin aprova em **Admin > Usuários**

### Convite
CompanyAdmin envia convite em **Admin > Usuários** → usuário recebe link `/empresa/invite/:token` → entra direto como `active`

## PWA
Arquivos em `public/`:
- `sw.js` — service worker
- `manifest.webmanifest` — manifesto PWA
- `icons/` — ícones da aplicação

## Deploy
```bash
npm run build
firebase deploy
```
