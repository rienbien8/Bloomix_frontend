/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00C2FF',       // 現在のメインブルー（そのまま残してOK）
          dark: '#00A0D1',          // 濃いブルー（そのまま残してOK）
          light: '#E7F9FF',         // 淡い水色（そのまま残してOK）

          citrus: '#A3E635',        // シトラスグリーン（lime-300）
          mint: '#CFFFEA',          // ミントグリーン（爽やかで柔らかい）
          lemon: '#FFFACD',         // レモンイエロー（popで軽快）
          sunrise: '#FBCFE8',       // 朝焼けピンク（pink-200）
          sky: '#38BDF8',           // 空色ブルー（sky-400）
          navy: '#1E3A8A',          // ネイビー（indigo-800）
          slate: '#94A3B8',         // グレー系ブルー（slate-300）
        }
      },
      boxShadow: {
        card: '0 8px 24px rgba(0,0,0,0.08)'
      },
      borderRadius: {
        '2xl': '1.25rem'
      }
    },
  },
  plugins: [],
}
