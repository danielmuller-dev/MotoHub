# Configuracao Inicial: GitHub, PostgreSQL e Vercel

Este guia deixa a ordem segura para publicar o MotoGestor.

## 1. GitHub

Crie um repositorio vazio no GitHub, sem README inicial, sem `.gitignore` e sem licenca, porque estes arquivos ja existem no projeto.

Depois, no terminal dentro da pasta do projeto:

```bash
git remote add origin https://github.com/SEU_USUARIO/motogestor.git
git branch -M main
git push -u origin main
```

Se preferir usar GitHub CLI, instale o `gh`, faca login e crie o remoto:

```bash
gh auth login
gh repo create SEU_USUARIO/motogestor --private --source=. --remote=origin --push
```

## 2. PostgreSQL

Crie um banco PostgreSQL em Neon, Supabase, Railway, Render ou outro provedor.

Copie a connection string no formato:

```txt
postgresql://USER:PASSWORD@HOST:5432/motogestor?schema=public
```

Cadastre esse valor como `DATABASE_URL`.

## 3. Variaveis de Ambiente

Use estas variaveis localmente e tambem na Vercel:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/motogestor?schema=public"
SESSION_SECRET="gere-uma-chave-grande-com-mais-de-32-caracteres"
NEXT_PUBLIC_APP_URL="https://seu-dominio.vercel.app"
```

Para gerar uma chave de sessao local:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Migrations e Seed

Depois que `DATABASE_URL` estiver configurada:

```bash
npm run prisma:deploy
npm run db:seed
```

O seed cria:

- Superadmin
- Empresa piloto
- Gestor
- Funcionario
- Cliente
- Motos
- Contratos
- Parcelas
- Pagamentos
- Manutencoes
- Documentos
- Avisos

## 5. Vercel

1. Importe o repositorio do GitHub na Vercel.
2. Configure as variaveis `DATABASE_URL`, `SESSION_SECRET` e `NEXT_PUBLIC_APP_URL`.
3. Use o build padrao do projeto:

```bash
npm run build
```

4. Depois do primeiro deploy, rode as migrations usando uma maquina local ou um job seguro com acesso ao banco:

```bash
npm run prisma:deploy
```

5. Rode o seed apenas quando quiser dados de demonstracao:

```bash
npm run db:seed
```

## 6. GitHub Actions

O workflow em `.github/workflows/ci.yml` roda:

- install
- Prisma validate
- lint
- typecheck
- testes
- build
- audit de dependencias de producao

## 7. Cuidados

- Nunca suba `.env`.
- Nunca use a senha demo em producao.
- Rode o seed somente em banco de demonstracao ou antes de iniciar dados reais.
- Em producao, crie uma senha forte para cada usuario.
