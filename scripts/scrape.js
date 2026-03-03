const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function scrapeMenu() {
  try {
    console.log('Menü çekiliyor...');
    
    const response = await axios.get('https://yemekhane.cu.edu.tr', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const menuData = {};
    const today = new Date();

    // Tarihi al
    const dateStr = today.toISOString().split('T')[0];
    menuData[dateStr] = {
      sabah: [],
      ogle: [],
      aksam: []
    };

    // Menü öğelerini çek
    $('.yemek-listesi, .menu-item, table tr, .yemek').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2) {
        menuData[dateStr].ogle.push({ ad: text, kalori: '' });
      }
    });

    // Veriyi kaydet
    const outputDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'menu.json'),
      JSON.stringify(menuData, null, 2),
      'utf8'
    );

    console.log('Menü başarıyla kaydedildi!');
    console.log(JSON.stringify(menuData, null, 2));

  } catch (error) {
    console.error('Hata:', error.message);
    
    // Hata olursa boş veri kaydet
    const today = new Date().toISOString().split('T')[0];
    const emptyData = {
      [today]: {
        sabah: [],
        ogle: [],
        aksam: [],
        hata: 'Menü çekilemedi'
      }
    };
    
    const outputDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(outputDir, 'menu.json'),
      JSON.stringify(emptyData, null, 2),
      'utf8'
    );
  }
}

scrapeMenu();
