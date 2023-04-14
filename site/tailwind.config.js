/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
    content: ["./js/**/*.{html,js}", "./pages/**/*.{html,js}"],
    theme: {
        extend: {
            backgroundImage: {
                'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
                'paper': "url('../textures/paper-min.jpg')",
                'tick': "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='rgb(67,48,43)' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z' /%3e%3c/svg %3e\")"
            },
            colors: {
                brown: {
                    50: '#fdf8f6',
                    100: '#f2e8e5',
                    200: '#eaddd7',
                    300: '#e0cec7',
                    400: '#d2bab0',
                    500: '#bfa094',
                    600: '#a18072',
                    700: '#977669',
                    800: '#846358',
                    850: '#5D443D',
                    900: '#43302b',
                },
                indigo: {
                    850: '#332F8F',
                }
            },
            fontFamily: {
                'merriweather': ['"Merriweather"', 'sans-serif'],
            },
            borderWidth: {
                3: '3px'
            },
            boxShadow: {
                'underline-2': 'inset 0 -2px 0 0',
                'underline-3': 'inset 0 -3px 0 0',
            },
            backdropBrightness: {
                1000: 1000
            }
        },
    },
    plugins: [
        require('tailwind-scrollbar')
    ],
};
