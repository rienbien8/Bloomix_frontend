const fs = require("fs");
const path = require("path");

// アイコンのサイズ一覧
const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

// カスタム画像を使用する設定
const useCustomImage = true; // カスタム画像を使用
const customImagePath = path.join(__dirname, "../public/custom-icon.png"); // カスタム画像のパス

// 基本的なSVGアイコンの内容（フォールバック用）
const baseIconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#grad1)"/>
  <circle cx="256" cy="256" r="120" fill="white" opacity="0.9"/>
  <circle cx="256" cy="256" r="80" fill="url(#grad1)"/>
  <path d="M200 180l120 76-120 76V180z" fill="white"/>
</svg>
`;

// アイコンディレクトリの作成
const iconsDir = path.join(__dirname, "../public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// カスタム画像からアイコンを生成する関数
async function generateIconsFromCustomImage() {
  try {
    const sharp = require("sharp");
    console.log("🔄 カスタム画像からアイコンを生成中...");

    // カスタム画像が存在するかチェック
    if (!fs.existsSync(customImagePath)) {
      console.log("❌ カスタム画像が見つかりません:", customImagePath);
      console.log("💡 public/custom-icon.png に画像を配置してください");
      return false;
    }

    console.log("✅ カスタム画像を発見:", customImagePath);

    for (const size of iconSizes) {
      const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

      await sharp(customImagePath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toFile(pngPath);

      console.log(
        `✅ ${size}x${size} カスタムアイコンを生成しました: ${pngPath}`
      );
    }

    // マスク可能アイコンのPNGも生成
    const maskablePngPath = path.join(iconsDir, "icon-maskable.png");
    await sharp(customImagePath)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(maskablePngPath);

    console.log(
      `✅ マスク可能カスタムアイコンを生成しました: ${maskablePngPath}`
    );

    // ファビコンのPNGも生成
    const faviconPngPath = path.join(__dirname, "../public/favicon.ico");
    await sharp(customImagePath)
      .resize(32, 32, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(faviconPngPath);

    console.log(`✅ ファビコンPNGを生成しました: ${faviconPngPath}`);

    return true;
  } catch (error) {
    console.log("❌ カスタム画像からのアイコン生成に失敗:", error.message);
    return false;
  }
}

// 各サイズのSVGアイコンを生成（フォールバック用）
iconSizes.forEach((size) => {
  const iconPath = path.join(iconsDir, `icon-${size}x${size}.svg`);

  // SVGのviewBoxとサイズを調整
  const svgContent = baseIconSVG.replace(
    'viewBox="0 0 512 512"',
    `viewBox="0 0 512 512" width="${size}" height="${size}"`
  );

  fs.writeFileSync(iconPath, svgContent);
  console.log(`✅ ${size}x${size} SVGアイコンを生成しました: ${iconPath}`);
});

// マスク可能アイコンの生成
const maskableIconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#grad1)"/>
  <circle cx="256" cy="256" r="120" fill="white" opacity="0.9"/>
  <circle cx="256" cy="256" r="80" fill="url(#grad1)"/>
  <path d="M200 180l120 76-120 76V180z" fill="white"/>
  <!-- マスク可能アイコン用の安全領域 -->
  <rect x="64" y="64" width="384" height="384" rx="96" fill="none" stroke="white" stroke-width="8" opacity="0.3"/>
</svg>
`;

const maskableIconPath = path.join(iconsDir, "icon-maskable.svg");
fs.writeFileSync(maskableIconPath, maskableIconSVG);
console.log(`✅ マスク可能アイコンを生成しました: ${maskableIconPath}`);

// ファビコンの生成
const faviconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#grad1)"/>
  <circle cx="16" cy="16" r="8" fill="white" opacity="0.9"/>
  <circle cx="16" cy="16" r="5" fill="url(#grad1)"/>
  <path d="M12 11l8 5-8 5V11z" fill="white"/>
</svg>
`;

const faviconPath = path.join(__dirname, "../public/favicon.svg");
fs.writeFileSync(faviconPath, faviconSVG);
console.log(`✅ ファビコンを生成しました: ${faviconPath}`);

// メイン処理
async function main() {
  if (useCustomImage) {
    console.log("🎨 カスタム画像を使用してアイコンを生成します");
    const success = await generateIconsFromCustomImage();
    if (success) {
      console.log("\n🎉 カスタム画像からのアイコン生成が完了しました！");
      return;
    } else {
      console.log(
        "\n⚠️ カスタム画像の生成に失敗したため、デフォルトアイコンを生成します"
      );
    }
  }

  // カスタム画像がない場合、デフォルトのPNGアイコンを生成
  await generateDefaultPNGIcons();
}

// PNGアイコンの生成（Sharpライブラリが利用可能な場合）
async function generateDefaultPNGIcons() {
  try {
    const sharp = require("sharp");
    console.log("\n🔄 デフォルトPNGアイコンの生成を開始...");

    for (const size of iconSizes) {
      const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
      const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

      await sharp(svgPath).resize(size, size).png().toFile(pngPath);

      console.log(`✅ ${size}x${size} PNGアイコンを生成しました: ${pngPath}`);
    }

    // マスク可能アイコンのPNGも生成
    const maskableSvgPath = path.join(iconsDir, "icon-maskable.svg");
    const maskablePngPath = path.join(iconsDir, "icon-maskable.png");

    await sharp(maskableSvgPath).resize(512, 512).png().toFile(maskablePngPath);

    console.log(`✅ マスク可能PNGアイコンを生成しました: ${maskablePngPath}`);

    // ファビコンのPNGも生成
    const faviconPngPath = path.join(__dirname, "../public/favicon.ico");

    await sharp(faviconPath).resize(32, 32).png().toFile(faviconPngPath);

    console.log(`✅ ファビコンPNGを生成しました: ${faviconPngPath}`);
  } catch (error) {
    console.log("\n⚠️  PNGアイコンの生成に失敗しました");
    console.log(
      "💡 Sharpライブラリがインストールされていないか、エラーが発生しました"
    );
    console.log("📦 インストール: npm install sharp");
    console.log("🔧 エラー詳細:", error.message);
  }
}

// メイン処理を実行
main().then(() => {
  console.log("\n🎉 すべてのアイコンの生成が完了しました！");
  console.log(
    "📱 PWA用のアイコンが public/icons/ ディレクトリに生成されました"
  );
  if (useCustomImage) {
    console.log("💡 カスタム画像からアイコンが生成されました");
  } else {
    console.log("💡 SVGとPNGの両方のアイコンが利用可能です");
  }
  console.log("\n🔧 カスタム画像を使用するには:");
  console.log("1. 画像を public/custom-icon.png に配置");
  console.log("2. スクリプト内の useCustomImage を true に設定");
  console.log("3. npm run generate-icons を実行");
});
 