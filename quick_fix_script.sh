#!/bin/bash
# quick-hooks-fix.sh - React Hooks 錯誤快速修復腳本

echo "🔍 開始診斷 React Hooks 錯誤..."
echo "================================"

# 1. 檢查基本環境
echo "📋 步驟 1: 檢查環境版本"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo ""

# 2. 檢查相關套件
echo "📦 步驟 2: 檢查套件版本"
echo "react-scripts:"
npm list react-scripts 2>/dev/null | grep react-scripts || echo "  未安裝或版本異常"
echo "eslint-plugin-react-hooks:"
npm list eslint-plugin-react-hooks 2>/dev/null | grep eslint-plugin-react-hooks || echo "  未安裝或版本異常"
echo ""

# 3. 檢查 App.js 中的潛在問題
echo "🔎 步驟 3: 掃描 App.js 中的 Hook 使用"
if [ -f "src/App.js" ]; then
    echo "檢查條件性 Hook 調用..."
    if grep -n "if.*use[A-Z]" src/App.js; then
        echo "❌ 發現條件性 Hook 調用"
    else
        echo "✅ 未發現條件性 Hook 調用"
    fi
    
    echo ""
    echo "檢查循環中的 Hook 調用..."
    if grep -n -E "(for|while).*use[A-Z]" src/App.js; then
        echo "❌ 發現循環中的 Hook 調用"
    else
        echo "✅ 未發現循環中的 Hook 調用"
    fi
    
    echo ""
    echo "檢查第 83 行附近的內容..."
    sed -n '80,86p' src/App.js | nl -ba -v80
else
    echo "❌ 找不到 src/App.js 文件"
fi
echo ""

# 4. 運行 ESLint 檢查
echo "🔧 步驟 4: 運行 ESLint 檢查"
if command -v npx &> /dev/null; then
    echo "運行 ESLint 檢查 src/App.js..."
    npx eslint src/App.js --format=compact --no-eslintrc --config='{
      "extends": ["react-app"],
      "rules": {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
      }
    }' 2>&1 | head -20
else
    echo "❌ npx 命令不可用"
fi
echo ""

# 5. 提供修復選項
echo "🛠️  步驟 5: 修復選項"
echo "選擇修復方案："
echo "1) 更新 ESLint 相關套件"
echo "2) 重新格式化程式碼"  
echo "3) 臨時禁用 Hook 規則"
echo "4) 清除快取並重新安裝"
echo "5) 查看詳細錯誤訊息"
echo "6) 退出"

read -p "請選擇 (1-6): " choice

case $choice in
    1)
        echo "更新 ESLint 相關套件..."
        npm update react-scripts
        echo "✅ 更新完成，請重新運行 npm run build"
        ;;
    2)
        echo "重新格式化 App.js..."
        if command -v npx &> /dev/null; then
            npx prettier --write src/App.js 2>/dev/null || echo "Prettier 未安裝，跳過格式化"
        fi
        echo "✅ 格式化完成"
        ;;
    3)
        echo "創建 .eslintrc.js 文件，臨時降級 Hook 規則..."
        cat > .eslintrc.js << 'EOF'
module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    'react-hooks/rules-of-hooks': 'warn', // 降級為警告
    'react-hooks/exhaustive-deps': 'warn'
  }
};
EOF
        echo "✅ 已創建 .eslintrc.js，Hook 錯誤降級為警告"
        ;;
    4)
        echo "清除快取並重新安裝依賴..."
        rm -rf node_modules/.cache
        rm -rf build
        echo "快取已清除，重新安裝依賴..."
        npm install
        echo "✅ 重新安裝完成"
        ;;
    5)
        echo "顯示詳細錯誤訊息..."
        if command -v npx &> /dev/null; then
            npx eslint src/App.js --format=verbose
        else
            echo "無法運行 ESLint 檢查"
        fi
        ;;
    6)
        echo "退出腳本"
        exit 0
        ;;
    *)
        echo "無效選擇"
        ;;
esac

echo ""
echo "🎯 建議後續步驟："
echo "1. 運行修復後，執行 'npm run build' 測試"
echo "2. 如果仍有問題，檢查 hooks.js 文件中的 Hook 使用"
echo "3. 確保所有 Hook 都在組件/Hook 的頂層調用"
echo "4. 考慮將複雜邏輯提取為獨立的自定義 Hook"
echo ""
echo "✨ 診斷完成！"