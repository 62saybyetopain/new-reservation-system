    // postcss.config.js
    export default {
      plugins: {
        // 根據錯誤訊息，需要明確引入 @tailwindcss/postcss
        // 雖然通常直接寫 tailwindcss: {} 即可，但若環境有問題，則需明確引入
    
        tailwindcss: {}, // 這是 Tailwind CSS 3 的標準插件
        autoprefixer: {},
      },
    }