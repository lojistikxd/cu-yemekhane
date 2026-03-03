const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function scrapeMenu() {
  try {
    console.log('Menü çekiliyor...');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Günün tarihini URL formatına çevir
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const url = `https://yemekhane.cu.edu.tr/default.asp?ymk=16&gun=${day}.${month}.${year}`;
    console.log('URL:', url);

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9'
      }
    });

    const $ = cheerio.load(response.data, { decoding: 'latin1' });
    
    const menuData = {};
    menuData[dateStr] = { sabah: [], ogle: [], aksam: [] };

    // Tablodaki yemekleri çek
    $('table tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const yemekAdi = $(cells[0]).text().trim();
        const kalori = $(cells[1]).text().trim();
        
        if (yemekAdi && yemekAdi.length > 2 && !yemekAdi.includes('₺') && !yemekAdi.includes('KADRO')) {
          menuData[dateStr].ogle.push({ ad: yemekAdi, kalori: kalori });
        }
      }
    });

    console.log('Çekilen menü:', JSON.stringify(menuData, null, 2));

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

  } catch (error) {
    console.error('Hata:', error.message);

    const today = new Date().toISOString().split('T')[0];
    const emptyData = {
      [today]: { sabah: [], ogle: [], aksam: [], hata: 'Menü çekilemedi' }
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
