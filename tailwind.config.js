module.exports = {
  content: [
    "./views/**/*.ejs",   // Обязательно
    "./routes/**/*.js",
    "./controllers/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
      sans: ['Rubik', 'sans-serif'],
      },
    },
  },
  plugins: [],
}