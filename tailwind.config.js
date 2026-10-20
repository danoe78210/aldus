export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        atelier: {
          bg: '#121110',
          card: '#1c1a17',
          cardHover: '#25231f',
          border: 'rgba(212, 175, 55, 0.20)',
          borderActive: 'rgba(212, 175, 55, 0.60)',
          parchment: '#f0ece1',
          parchmentMuted: '#c5bfb2',
          gold: '#d4af37',
          goldDark: '#8c7322',
          alertRed: '#8f2d2d',
        },
      },
    },
  },
  plugins: [],
}