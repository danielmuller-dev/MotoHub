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
