# Agendaê — Saúde na Palma da Mão

Primeira etapa do P.I SENAC: PWA simples para organizar consultas de demonstração. Interface em português, responsiva, sem dependências de produção.

## Executar

Requer Node.js 22 ou superior.

```sh
npm start
```

Abra **http://localhost:3000**. Não abra o HTML diretamente: Service Worker precisa de localhost ou HTTPS.

## O que está pronto

- Início, agendamento, minhas consultas e ajuda.
- Especialidade → unidade → profissional → data → horário.
- Salvar, listar e cancelar consultas; persistência local após fechar o navegador.
- Validação de datas futuras, dias úteis e conflitos de horário neste dispositivo.
- Backend Node.js: `GET /api/catalog` e `POST /api/appointments` (validação).
- Manifest com nome, cores, ícones 192/512, ícone maskable e standalone.
- Service Worker com cache do HTML, CSS, JS, catálogo e ícones.
- Operação offline após primeiro acesso: abrir, salvar, listar e cancelar.
- Instalação oferecida pelo navegador quando suportada; instruções em Ajuda.

## Escopo e dados

**Demonstração acadêmica: nenhuma consulta real é marcada.** Todos os profissionais e unidades são fictícios. Use apenas um nome fictício. Os agendamentos ficam no `localStorage` deste navegador e podem ser apagados em Ajuda.

A API valida a entrada online e devolve um identificador. Ela **não persiste agendamentos**, não consulta disponibilidade real e não possui banco remoto. Offline, a validação ocorre no cliente. Conflitos são impedidos neste navegador; não há reserva compartilhada entre usuários. O catálogo do backend possui uma cópia local para funcionar offline. Para atualizar ambos, execute `node tools/generate-assets.cjs`.

O checklist enviado no pedido define o escopo desta entrega. Os documentos serviram de referência para o domínio, o fluxo e a acessibilidade. O PDF descreve uma entrega mais ampla: JWT, perfis, banco e CRUD administrativo são próximos passos, junto com a IA do DOCX. Esta versão usa escolha manual da especialidade e não faz diagnóstico.

## Estrutura

```text
public/         Front-end, manifest, service worker e ícones
api/            Funções serverless compatíveis com Vercel
lib/            Catálogo e regras de validação do backend
server.cjs      Servidor local sem dependências
tests/          Testes de regras, API e navegador
tools/          Geração dos ícones e do catálogo offline
vercel.json     Configuração da hospedagem
```

## Testes

```sh
npm ci
npm test
npm run test:e2e
```

Os testes de navegador usam o Google Chrome instalado. Validam persistência, conflito, cancelamento, agendamento e recarga offline; verificam o manifest, o cache e o layout em 390 px. Capturas ficam em `artifacts/`.

## Apresentação (3 minutos)

1. Início: explicar a proposta de simplificar o agendamento.
2. Agendar: salvar uma consulta fictícia e abrir Consultas.
3. Mostrar `public/manifest.json`: nome, ícones, cores e standalone.
4. Mostrar `public/sw.js`: arquivos essenciais no cache.
5. Em Ajuda, esperar “Modo offline pronto”. No DevTools → Network, selecionar Offline e recarregar.
6. Mostrar a consulta salva; cancelar e criar outra offline.
7. Instalar usando o botão, se oferecido. Para verificar: DevTools → Application → Manifest e Service Workers. No iPhone: Safari → Compartilhar → Adicionar à Tela de Início.
8. Próximos passos: autenticação, banco remoto, integração com clínicas e pré-triagem validada.

## Publicação no GitHub e Vercel

O pedido autoriza publicar o projeto. Requer autenticação válida nos dois serviços. Execute no PowerShell:

```powershell
.\publicar.ps1
```

O script cria um repositório **privado** `agendae-pwa` no GitHub e faz deploy de produção na Vercel. A URL do site é pública e contém apenas dados fictícios. Ele não publica os documentos fornecidos nem arquivos de credenciais. O projeto usa a configuração “Other” com saída `public` e funções em `api`, conforme a [documentação da Vercel](https://vercel.com/docs/project-configuration/vercel-json).

O script também executa `vercel git connect --yes` para ativar os próximos deploys por push, conforme a [documentação da integração Git](https://vercel.com/docs/cli/git). A conta Vercel precisa ter acesso ao repositório GitHub; se faltar essa autorização, o script informa a pendência. Sem conectar os serviços, o projeto continua disponível localmente.
