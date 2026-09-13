/**
 * Design tokens for the mobile app, extraídos do PassaSorte_Design
 * System.pdf (v1.0) fornecido pelo usuário - especialmente a seção 11
 * "Design tokens de produto" (cor, espaçamento, raio/elevação) e a seção
 * 5 "Teoria das cores" (hex de cada cor de marca). As seções 6-10
 * (gradiente, tipografia, linguagem gráfica, iconografia, fotografia) e
 * os mockups da seção 17 ("Aplicações", p.18) informam como esses
 * valores devem ser combinados na prática.
 *
 * Fonte: o PDF pede "Inter Display" para headlines e "Inter" para
 * produto/interface, mas é explícito em que "a identidade vem de
 * escala, espaço e cor - não de fontes caricatas" (p.7/p.20). Para não
 * somar mais uma dependência presa a uma versão específica do Expo SDK
 * em cima de tudo que já precisou ser corrigido só para o app abrir
 * (ver metro.config.js), esta primeira aplicação do design system usa a
 * fonte padrão da plataforma (San Francisco no iOS, Roboto no Android -
 * ambas sans-serifs geométricas, no mesmo espírito da Inter) na escala e
 * peso exatos definidos na seção 7. Trocar por Inter de verdade depois
 * (via @expo-google-fonts/inter) é um passo separado, não um bloqueio
 * para ter a identidade visual aplicada.
 */
export const colors = {
  navy: "#10162F", // Noite - confiança, profundidade, tecnologia
  territory: "#2B2D70", // Território - estratégia, espaço, controle
  violet: "#6D5DFB", // Movimento - inovação, deslocamento, digital
  coral: "#FF6B57", // Calor - proximidade, emoção, ação
  amber: "#FFB84D", // Pulso - energia, recompensa, destaque
  aqua: "#2CC9B7", // Descoberta - valor, confirmação, frescor
  cream: "#FDF3EA", // fundo claro usado nas telas de produto (p.2, p.18) - o PDF não dá um hex exato para o cream, este é uma aproximação fiel aos mockups
  white: "#FFFFFF",
  // Utilitários de UI que o design system não define (ele evita
  // propositalmente vermelho/verde de aposta) - usados só para estado
  // de erro e texto secundário, nunca para significado de marca.
  danger: "#DC2626",
  textMuted: "#6B7280",
} as const;

/**
 * p.13 "Temperatura": 5 estados. O PDF só dá hex para Frio (violet),
 * Quente (coral) e Muito quente (amber, por analogia com "Pulso");
 * Congelando usa o Navy da paleta principal. "Morno" não tem hex
 * próprio no documento - o valor abaixo interpola o gradiente
 * proprietário (violeta -> coral, p.7) entre Frio e Quente, e é uma
 * escolha puramente visual desta implementação, não uma decisão de
 * negócio.
 */
export const temperatureColors = {
  CONGELANDO: colors.navy,
  FRIO: colors.violet,
  MORNO: "#A8577C",
  QUENTE: colors.coral,
  MUITO_QUENTE: colors.amber,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

// p.11/p.12 "Raio & elevação".
export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

// p.7 "Tipografia" - tamanho/altura de linha/peso de cada nível da escala.
export const typography = {
  display: { fontSize: 48, lineHeight: 52, fontWeight: "900" as const },
  h1: { fontSize: 36, lineHeight: 40, fontWeight: "700" as const },
  h2: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "600" as const, letterSpacing: 0.5 },
} as const;

// p.12 "Sombras suaves, sem brilho neon."
export const shadow = {
  card: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;
