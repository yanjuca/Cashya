<div align="center">

# `cashya`

**Controle financeiro pessoal e compartilhado com design minimalista, retrô-futurista e foco em simplicidade.**

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo Router](https://img.shields.io/badge/Expo%20Router-v6-000?style=for-the-badge&logo=expo&logoColor=white)](https://docs.expo.dev/router/introduction/)
[![Platforms](https://img.shields.io/badge/Platforms-Android%20%7C%20iOS%20%7C%20Web-E95420?style=for-the-badge)](https://expo.dev)

</div>

---

## 📑 Sumário

- [Visão Geral](#-visão-geral)
- [Destaques & Diferenciais](#-destaques--diferenciais)
- [Funcionalidades](#-funcionalidades)
- [Design & Identidade Visual](#-design--identidade-visual)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Modelo de Dados](#-modelo-de-dados)
- [Como Começar](#-como-começar)
  - [Pré-requisitos](#pré-requisitos)
  - [Instalação](#instalação)
  - [Executando o App](#executando-o-app)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Compilação & Build (EAS)](#-compilação--build-eas)
- [Roadmap de Melhorias](#-roadmap-de-melhorias)
- [Licença & Créditos](#-licença--créditos)

---

## 💡 Visão Geral

O **Cashya** é um aplicativo mobile de gestão de despesas e finanças pessoais e compartilhadas, desenvolvido com **React Native** e **Expo**. Ele nasceu para resolver o problema de controle de contas e divisão de gastos com terceiros de forma direta, sem telas poluídas, sem necessidade de logins complexos e sem fricção.

Inspirado na estética retrô-futurista e minimalista de sistemas como o **Nothing OS** (utilizando a tipografia Dot-Matrix `Ndot57`), o aplicativo combina elegância visual com uma experiência de uso rápida, fluida e totalmente **offline-first**.

---

## ✨ Destaques & Diferenciais

- 🔒 **Privacidade Total & Offline-First**: Todas as informações são persistidas localmente no dispositivo via `AsyncStorage`. Seus dados nunca saem do seu aparelho sem sua autorização.
- ⚡ **Zero Burocracia**: Abra o app e use imediatamente — sem telas de cadastro ou autenticação obrigatória.
- 🎨 **Estética Única (Dot-Matrix & Dark Mode)**: Fundo com gradiente sutil escuro, contraste em vermelho vibrante (`#ff5252`) e fontes exclusivas `Ndot57`.
- 👥 **Divisão Inteligente de Contas**: Acompanhe facilmente quem deve pagar ou já realizou o pagamento de cada despesa.
- 📊 **Dashboard Estatístico Completo**: Relatórios visuais com divisão por pessoa, por categoria/tag e histórico dos últimos 6 meses.

---

## 🚀 Funcionalidades

### 1. 💸 Registro & Gestão de Despesas
- **Cadastro Completo**: Adicione despesa informando descrição, valor, pagador/devedor, data (com seletor nativo `DateTimePicker`) e tags.
- **Edição Flexível**: Atualize qualquer informação da despesa a qualquer momento.
- **Exclusão Segura**: Remova despesas com caixa de diálogo de confirmação para evitar perdas acidentais.

### 2. 📅 Navegação Temporal por Mês
- Alterne entre os meses de forma fluida através dos botões de navegação.
- Cálculo automático e em tempo real dos indicadores do mês selecionado:
  - **Month Total**: Soma de todas as despesas do mês.
  - **Pending**: Total ainda pendente de acerto no mês.

### 3. 🔄 Status de Pagamento Rápido
- **Toque Longo (Long Press)** no card da despesa para alternar entre status **Pendente** (ponto vermelho) e **Pago** (ponto verde).
- Identificação visual imediata do status através dos indicadores de cor.

### 4. 🏷️ Categorias & Filtros Interativos
- Crie tags dinâmicas para classificar suas despesas (ex.: `#alimentação`, `#viagem`, `#mercado`).
- Barra de rolagem horizontal com **Chips de Filtro**:
  - Filtre por **pessoa** com um único clique.
  - Filtre por **tag/categoria**.
  - Botão para limpar filtros ativos instantaneamente.

### 5. 📊 Painel de Estatísticas (`StatisticsScreen`)
- **Cards de Métricas**:
  - Total geral acumulado.
  - Valor total pago (com porcentagem do total).
  - Valor total pendente (com porcentagem do total).
  - Ticket médio por despesa.
- **Detalhamento por Pessoa**:
  - Lista de participantes com número de despesas, montante total e valor ainda pendente.
- **Detalhamento por Categoria**:
  - Ranking de tags mais utilizadas com percentual do gasto total.
- **Tendência dos Últimos 6 Meses**:
  - Gráfico de barras proporcional comparando os últimos 6 meses de gastos.

---

## 🎨 Design & Identidade Visual

O Cashya segue diretrizes de design minimalistas com inspiração techno-futurista:

| Elemento | Valor / Especificação |
| :--- | :--- |
| **Cor Primária** | `#ff5252` (Vermelho vibrante de destaque) |
| **Dark Gradient Start** | `#2a1a1a` (Preto com leve matiz vermelho escuro) |
| **Dark Gradient End** | `#1a1a1a` (Preto profundo) |
| **Fundo de Cartões** | `#2a2a2a` |
| **Bordas** | `#3a3a3a` |
| **Tipografia Títulos** | `Ndot57` e `Ndot57Caps` (Estilo Matrix / Dot-font) |
| **Tipografia Conteúdo** | Fonte nativa do sistema (`System`) com alta legibilidade |

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Finalidade |
| :--- | :--- |
| [**React Native 0.81**](https://reactnative.dev) | Framework para construção de apps nativos para iOS e Android |
| [**Expo SDK 54**](https://expo.dev) | Plataforma de desenvolvimento e compilação de aplicações universais |
| [**TypeScript 5.9**](https://www.typescriptlang.org/) | Tipagem estática para robustez e manutenção do código |
| [**Expo Router 6**](https://docs.expo.dev/router/introduction/) | Navegação moderna e intuitiva baseada em sistema de arquivos |
| [**AsyncStorage**](https://react-native-async-storage.github.io/async-storage/) | Banco de dados chave-valor local para persistência de dados offline |
| [**Expo Linear Gradient**](https://docs.expo.dev/versions/latest/sdk/linear-gradient/) | Gradientes de cores de fundo |
| [**Expo Vector Icons**](https://icons.expo.fyi/) | Conjunto de ícones nativos (Ionicons e MaterialIcons) |
| [**Expo Haptics**](https://docs.expo.dev/versions/latest/sdk/haptics/) | Feedback tátil e vibrações nas interações |
| [**React Native DateTimePicker**](https://github.com/react-native-datetimepicker/datetimepicker) | Componente nativo de seleção de data e hora |
| [**React Native Reanimated 4**](https://docs.swmansion.com/react-native-reanimated/) | Motor de animações nativas fluidas |
| [**Expo EAS Build**](https://expo.dev/eas) | Sistema de compilação em nuvem para gerar binários (.apk / .aab / .ipa) |

---

## 📁 Estrutura do Projeto

Abaixo está o mapeamento dos principais diretórios e arquivos da aplicação:

```
Cashya/
├── app/                              # Rotas e páginas do Expo Router
│   ├── (tabs)/                       # Navegação por abas
│   │   ├── _layout.tsx               # Configuração da barra de navegação
│   │   ├── explore.tsx               # Tela secundária / exploração
│   │   └── index.tsx                 # Ponto de entrada que renderiza a HomeScreen
│   ├── _layout.tsx                   # Layout raiz, carregamento de fontes e Providers
│   └── modal.tsx                     # Rota de modal
│
├── assets/                           # Arquivos estáticos
│   ├── fonts/                        # Fontes personalizadas (Ndot57, Ndot57Caps)
│   └── images/                       # Ícones, splash screens e logotipos
│
├── components/                       # Componentes reutilizáveis
│   ├── screens/                      # Telas principais da aplicação
│   │   ├── HomeScreen.tsx            # Tela principal (feed, filtros, navegação de mês)
│   │   ├── AddExpenseScreen.tsx      # Modal de cadastro de nova despesa
│   │   ├── EditExpenseScreen.tsx     # Modal de edição/exclusão de despesa
│   │   └── StatisticsScreen.tsx      # Painel analítico de gastos e gráficos
│   └── ui/                           # Componentes visuais utilitários (ícones, botões)
│
├── contexts/                         # Gerenciamento de estado global
│   └── ExpensesContext.tsx           # Contexto e hooks com persistência AsyncStorage
│
├── hooks/                            # Custom React Hooks
│   ├── useFonts.ts                   # Hook de carregamento das fontes Ndot57
│   ├── use-color-scheme.ts           # Detecção de tema claro/escuro
│   └── use-theme-color.ts            # Utilitário de cores baseado no tema
│
├── theme.ts                          # Configurações do Design System (cores, fontes, espaçamentos)
├── app.json                          # Metadados e configurações do Expo e compilação
├── eas.json                          # Configurações do Expo Application Services (Builds)
├── package.json                      # Dependências e scripts do projeto
└── tsconfig.json                     # Configurações do compilador TypeScript
```

---

## 📦 Modelo de Dados

O núcleo de dados da aplicação gira em torno da interface `Expense`:

```typescript
export interface Expense {
  id: string;          // Identificador único (timestamp + hash)
  description: string; // Descrição ou nome da despesa
  amount: number;      // Valor monetário (ex.: 150.50)
  person: string;      // Responsável pelo pagamento / participante
  date: Date;          // Data em que a despesa foi realizada
  tags: string[];      // Lista de etiquetas (ex.: ["Aluguel", "Casa"])
  paid: boolean;       // Indicador de pagamento efetuado (true / false)
}
```

---

## 🏁 Como Começar

### Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:
- [**Node.js**](https://nodejs.org/) (versão 18 ou superior recomendada)
- Gerenciador de pacotes **npm** ou **yarn**
- Aplicativo móvel [**Expo Go**](https://expo.dev/go) instalado em seu smartphone (Android ou iOS) para testes em tempo real via Wi-Fi.

### Instalação

1. Clone este repositório:
   ```bash
   git clone https://github.com/yanjuca/Cashya.git
   ```

2. Acesse a pasta do projeto:
   ```bash
   cd Cashya/Cashya
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```

### Executando o App

Inicie o servidor de desenvolvimento do Expo:

```bash
npx expo start
```

No terminal ou na interface web aberta, você terá as seguintes opções:

- **Dispositivo Físico**: Abra a câmera (no iOS) ou o app Expo Go (no Android) e escaneie o **QR Code** exibido no terminal.
- **Emulador Android**: Pressione <kbd>a</kbd> no terminal (requer Android Studio configurado).
- **Simulador iOS**: Pressione <kbd>i</kbd> no terminal (requer Xcode em ambiente macOS).
- **Navegador Web**: Pressione <kbd>w</kbd> no terminal.

---

## 📜 Scripts Disponíveis

Dentro do diretório do projeto, você pode executar:

| Comando | Descrição |
| :--- | :--- |
| `npm start` ou `npx expo start` | Inicia o servidor de desenvolvimento do Expo Metro Bundler |
| `npm run android` | Inicia o app diretamente no emulador ou dispositivo Android conectado |
| `npm run ios` | Inicia o app diretamente no simulador iOS (somente macOS) |
| `npm run web` | Inicia o app na versão web |
| `npm run lint` | Executa o linter ESLint para validar boas práticas e padrões de código |
| `npm run reset-project` | Executa o script auxiliar de reset do template Expo caso necessário |

---

## 🏗️ Compilação & Build (EAS)

O projeto já possui o [EAS Build](https://docs.expo.dev/build/introduction/) configurado através do arquivo `eas.json`.

Para gerar builds de produção ou teste:

1. Instale a CLI global do EAS (caso não tenha):
   ```bash
   npm install -g eas-cli
   ```

2. Faça login na sua conta Expo:
   ```bash
   eas login
   ```

3. Configure ou execute uma build:
   - **Build de Teste / Preview (APK direto para Android)**:
     ```bash
     eas build -p android --profile preview
     ```
   - **Build de Produção**:
     ```bash
     eas build -p android --profile production
     ```

---

## 🗺️ Roadmap de Melhorias

- [ ] Exportação de relatórios em formato CSV e PDF.
- [ ] Suporte a múltiplas moedas com conversão automática (BRL, USD, EUR).
- [ ] Recorrência de despesas (despesas fixas mensais automáticas).
- [ ] Backup e restauração via arquivo JSON ou nuvem (Google Drive / iCloud).
- [ ] Proteção do app por biometria (Face ID / Fingerprint) via `expo-local-authentication`.
- [ ] Modo escuro / modo claro alternável nas preferências.

---

## 📄 Licença & Créditos

Desenvolvido com carinho por [Yan Juca](https://github.com/yanjuca).

Distribuído sob a licença **MIT**. Consulte o arquivo de licença para mais detalhes.

<div align="center">
  <sub>Construído com ❤️, React Native e Expo.</sub>
</div>
