# Plano de Ação: Refatoração Estrutural + Preparação do Cashya

## 1. Análise sobre o Catcher de Notificação vs. Alternativas

Respondendo diretamente à sua dúvida sobre viabilidade e alternativas sem integração bancária/Open Finance:

### É viável?
**Sim, no Android é extremamente viável e comum em apps locais**. 
- O Android disponibiliza a API oficial `NotificationListenerService`.
- **Vantagem**: Não requer Open Finance, credenciais bancárias nem servidores intermediários. Toda a leitura e processamento ocorrem estritamente dentro do dispositivo (offline-first).
- **Limitação no iOS**: O iOS proíbe apps de interceptar notificações de outros apps por questão de segurança e sandbox.

### Como entregar uma experiência "sem cadastro manual" de forma elegante e universal?
Para resolver a dor do usuário não precisar digitar tudo na mão sem depender de integrações complexas de banco:

1. **Android - Background Notification Listener**:
   - Escuta em background alertas de apps como Nubank, Itaú, Inter, Mercado Pago, C6, etc.
   - Extrai via Regex local: valor, estabelecimento e data/hora.
   - Coloca os itens em uma fila/inbox pendente de aprovação (para você só bater o olho e dar um "ok" ou ajustar a categoria).

2. **iOS & Android - "Smart Paste / Share Sheet" (Leitor Inteligente de Área de Transferência ou Compartilhamento)**:
   - O usuário copia o texto do comprovante ou SMS do Pix, ou clica em "Compartilhar comprovante" para o Cashya.
   - O app identifica automaticamente: *"Detectamos uma transferência de R$ 45,00 para Padaria Santos. Deseja adicionar?"*.

3. **Importador Rápido de Extrato Local (OFX / CSV)**:
   - Todo banco permite baixar `.ofx` ou `.csv` do mês com 1 clique.
   - O Cashya pode importar o arquivo localmente em menos de 1 segundo sem passar por servidor algum.

Essa combinação garante que usuários Android tenham automação 100% passiva, e usuários iOS tenham fricção quase zero (1 clique para compartilhar/colar).

---

## 2. Decisões Consolidadas

1. **Calendário como View Padrão (Default)**:
   - A tela inicial abrirá por padrão na visualização de **Grade de Calendário Mensal** (estilo Nothing OS com pontinhos de status).
   - Um botão discreto e estilizado no topo (header) permitirá alternar instantaneamente entre **Calendário** e **Lista Linear**.
   - O estado selecionado (ou a data clicada no calendário) filtra os detalhes logo abaixo.
2. **Prioridade Imediata - Refatoração Estrutural**:
   - Limpeza de boilerplate/código morto deixado pelo template do Expo.
   - Organização da arquitetura de serviços e dados (`services/storage.ts` ou modelos).
   - Modularização da [HomeScreen.tsx](file:///home/yanj/Projetos/Cashya/components/screens/HomeScreen.tsx) para não ficar monolítica antes de receber o calendário e o recap.

---

## 3. Passo a Passo da Refatoração Estrutural (Fase 1)

### Etapa 1.1: Limpeza de Arquivos Template Órfãos
Remover arquivos gerados pelo create-expo-app que não estão em uso pelo Cashya:
- `components/hello-wave.tsx`
- `components/parallax-scroll-view.tsx`
- `components/themed-text.tsx`
- `components/themed-view.tsx`
- `components/ui/collapsible.tsx`
- `components/ui/icon-symbol.ios.tsx` e `components/ui/icon-symbol.tsx`
- `app/(tabs)/explore.tsx`
- `app/modal.tsx`

### Etapa 1.2: Simplificação de Rotas do Expo Router
- Manter apenas as rotas reais do Cashya, deixando o `app/` enxuto e consistente.

### Etapa 1.3: Criação da Camada de Serviços e Utilitários (`services/` e `utils/`)
- `services/storage.ts`: Isolar o acesso ao `AsyncStorage` com tipagem forte e tratamento de exceções.
- `utils/formatters.ts`: Centralizar formatação de moeda (BRL `R$`) e datas em português.

### Etapa 1.4: Quebra dos Componentes da HomeScreen
- Extrair o cabeçalho (`HomeHeader.tsx`) com o botão de toggle para a visão (Calendário / Lista).
- Extrair os cards de totais e filtros para componentes específicos reutilizáveis.

---

## 4. Próxima Etapa após a Refatoração
Assim que a base estiver limpa e modularizada, implementaremos o componente **`CalendarView`** integrado como visualização padrão da tela inicial.
