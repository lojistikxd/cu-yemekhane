const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

async function scrapeMenu() {
  try {
    console.log('Menü çekiliyor...');

    const response = await axios.get('https://yemekhane.cu.edu.tr/default.asp?ymk=16', {
      timeout: 15000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9'
      }
    });

    const html = iconv.decode(Buffer.from(response.data), 'windows-1254');
    const $ = cheerio.load(html);
    const menuData = {};

    $('div.col-md-2, div.col-md-3').each((i, el) => {
      const baslik = $(el).find('a').first().text().trim();
      if (!baslik || !baslik.includes('.')) return;

      const tarihMatch = baslik.match(/(\d+\.\d+\.\d+)/);
      if (!tarihMatch) return;

      const parcalar = tarihMatch[1].split('.');
      const tarih = `${parcalar[2]}-${parcalar[1].padStart(2,'0')}-${parcalar[0].padStart(2,'0')}`;

      const yemekler = [];
      $(el).find('ul li a').each((j, yemekEl) => {
        const title = $(yemekEl).attr('title') || '';
        const kaloriMatch = $(yemekEl).text().match(/(\d+)\s*Kalori/i);
        const kalori = kaloriMatch ? kaloriMatch[1] : '';
        
        // Yemek adını title'dan al (örn: "3.03.2026 - Etli Nohut")
        const adMatch = title.match(/\d+\.\d+\.\d+\s*-\s*(.+)/);
        const ad = adMatch ? adMatch[1].trim() : '';
        
        if (ad && ad.length > 1) {
          yemekler.push({ ad, kalori });
        }
      });

      if (yemekler.length > 0) {
        menuData[tarih] = { sabah: [], ogle: yemekler, aksam: [] };
      }
    });

    console.log('Çekilen günler:', Object.keys(menuData));

    const outputDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'menu.json'),
      JSON.stringify(menuData, null, 2),
      'utf8'
    );

    console.log('Başarıyla kaydedildi!');

  } catch (error) {
    console.error('Hata:', error.message);
  }
}

scrapeMenu();
