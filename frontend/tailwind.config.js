import daisyui from 'daisyui'
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [daisyui],
  daisyui: {
    themes: [{
      securefdr: {
        primary: '#1e40af', 'primary-content': '#ffffff',
        secondary: '#0f766e', accent: '#7c3aed', neutral: '#0f172a',
        'base-100': '#ffffff', 'base-200': '#f1f5f9', 'base-300': '#e2e8f0',
        info: '#2563eb', success: '#16a34a', warning: '#f59e0b', error: '#dc2626',
      },
    }],
  },
}
