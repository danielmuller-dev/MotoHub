# MotoGestor

MotoGestor e um MVP funcional de uma plataforma SaaS multiempresa para gestao de locadoras de motos. A aplicacao cobre empresas, usuarios, clientes, motos, contratos, parcelas, pagamentos, manutencoes, documentos, avisos internos, auditoria, dashboard, relatorios e area do cliente.

## Tecnologias

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Cookies HTTP-only para sessao
- Zod
- React Hook Form
- Lucide React
- Recharts
- Vitest

## Estrutura de Pastas

```txt
src/
  app/                  Rotas publicas, autenticadas e server actions
  components/           UI reutilizavel, formularios e graficos
  lib/                  Configuracao, auth, datas, formatacao e regras puras
  services/             Regras de negocio com Prisma
prisma/
  schema.prisma         Modelagem do banco
  seed.ts               Dados de demonstracao
  migrations/           Migration inicial PostgreSQL
tests/                  Testes automatizados de regras criticas
```

## Modelagem Principal

Entidades: `Company`, `CompanySettings`, `User`, `Customer`, `Motorcycle`, `Contract`, `Installment`, `Payment`, `Maintenance`, `Document`, `Notification`, `NotificationRecipient` e `AuditLog`.

Todas as entidades operacionais possuem `companyId`. As consultas das areas protegidas filtram pelo `companyId` do usuario autenticado, e a area do cliente filtra tambem pelo `customerId`.

Campos importantes de vencimento do contrato:

- `billingFrequency`
- `firstDueDate`
- `weeklyDueDay`
- `monthlyDueDay`
- `monthlyOverflowRule`

## Variaveis de Ambiente

Crie um `.env` local com base em `.env.example`.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require"
SESSION_SECRET="troque-por-uma-chave-com-pelo-menos-32-caracteres"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Instalar e Rodar Localmente

```bash
npm install --cache .npm-cache
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Abra `http://localhost:3000`.

## Contas de Demonstracao

Senha temporaria de todas as contas do seed:

```txt
MotoGestor@123
```

Contas:

- Superadmin: `admin@motogestor.demo`
- Gestor da locadora: `gestor@motogestor.demo`
- Funcionario: `funcionario@motogestor.demo`
- Cliente: `cliente@motogestor.demo`

## Scripts

```bash
npm run dev
npm run start
npm run ci
npm run build
npm run lint
npm run typecheck
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run db:seed
npm run prisma:studio
```

## Funcionalidades do MVP

- Login e logout com cookie HTTP-only
- Hash seguro de senha
- Redirecionamento por perfil
- Bloqueio de usuarios inativos
- Superadmin com dashboard e gestao de empresas
- Criacao de administrador por empresa
- Dashboard da locadora com indicadores, vencimentos, atrasos, manutencoes e documentos
- Clientes com busca, filtros, paginacao e detalhe
- Motos com busca, filtros, tabela/cards e status visual
- Contratos `RENTAL` e `RENT_TO_OWN`
- Geracao automatica de parcelas
- Regras semanais, quinzenais e mensais de vencimento
- Previa das parcelas antes de ativar contrato
- Registro de pagamentos integrais e parciais
- Conclusao automatica de contrato quitado
- Moto marcada como `SOLD` em contrato de compra quitado
- Recibo imprimivel
- Manutencoes
- Documentos com alertas por vencimento
- Avisos internos com leitura pelo cliente
- Area do cliente
- Relatorios em tela com opcao de impressao
- Configuracoes da empresa
- Historico de auditoria

## Testes

Os testes cobrem:

- Isolamento entre empresas
- Cliente acessando apenas seus dados
- Geracao de parcelas semanais, quinzenais e mensais
- Fevereiro em ano comum e bissexto
- Pagamento parcial
- Pagamento integral
- Bloqueio de pagamento negativo ou acima do saldo
- Conclusao automatica por parcelas pagas
- Bloqueio de dois contratos ativos para a mesma moto

Execute:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## GitHub

1. Crie um repositorio vazio no GitHub.
2. No projeto local:

```bash
git init
git add .
git commit -m "feat: cria MVP MotoGestor"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/motogestor.git
git push -u origin main
```

Nao envie `.env`, tokens, senhas reais ou chaves privadas.

Tambem existe um guia direto em `docs/configuracao-inicial.md`.

## PostgreSQL

Use Neon PostgreSQL para o primeiro deploy.

1. Crie o banco.
2. Mantenha o Neon Auth desligado.
3. Copie a URL com `Connection pooling` ligado para `DATABASE_URL`.
4. Copie a URL com `Connection pooling` desligado para `DIRECT_URL`.
5. Configure essas variaveis localmente e na Vercel.
6. Rode migrations:

```bash
npm run prisma:deploy
```

7. Para dados de demo:

```bash
npm run db:seed
```

## Vercel

1. Publique o repositorio no GitHub.
2. Crie um projeto na Vercel importando o repositorio.
3. Cadastre as variaveis:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_APP_URL`
4. Use o build command padrao:

```bash
npm run build
```

5. Apos o deploy, rode as migrations em um ambiente com acesso ao banco:

```bash
npm run prisma:deploy
```

6. Rode o seed apenas quando quiser recriar os dados de demonstracao:

```bash
npm run db:seed
```

## Possiveis Erros de Build

- `DATABASE_URL` ausente: configure a variavel no ambiente.
- Prisma Client desatualizado: rode `npm run prisma:generate`.
- Banco sem tabelas: rode `npm run prisma:deploy`.
- Login falhando apos deploy: confirme `SESSION_SECRET` e se o usuario esta ativo.
- Empresa inativa: ative a empresa pelo superadmin.

## Limites do MVP

Ainda nao inclui rastreamento GPS, Detran, consulta de multas, Pix automatico, gateway de pagamento, assinatura digital oficial, WhatsApp/SMS/e-mail real, app nativo, cobranca de planos SaaS, reconhecimento facial ou upload complexo. A estrutura deixa esses pontos preparados para uma versao 2.

## Proximas Melhorias

- Rate limit persistente para login
- Rotacao e expiracao configuravel de sessoes
- Convites por e-mail
- Upload com Vercel Blob ou S3
- Exportacao PDF/Excel dos relatorios
- Webhooks de pagamento
- Assinaturas SaaS e planos
- Observabilidade e trilha de auditoria mais detalhada
