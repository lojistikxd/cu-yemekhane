const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const SUPABASE_URL = 'https://qulpvvhpysahsybkhcnv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_KEY = process.env.RESEND_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const resend = new Resend(RESEND_KEY);

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

    console.log('Menü kaydedildi!');

    // Bildirim gönder
    await bildirimGonder(menuData);

  } catch (error) {
    console.error('Hata:', error.message);
  }
}

async function bildirimGonder(menuData) {
  try {
    console.log('Bildirimler kontrol ediliyor...');

    // Bugünün tarihini al
    const bugun = new Date(new Date().toLocaleString('tr-TR', {timeZone: 'Europe/Istanbul'}));
    const bugunStr = `${bugun.getFullYear()}-${String(bugun.getMonth()+1).padStart(2,'0')}-${String(bugun.getDate()).padStart(2,'0')}`;
    console.log('Bugün tarihi:', bugunStr);
    console.log('Menüde olan tarihler:', Object.keys(menuData));

    const bugunMenu = menuData[bugunStr];
    if (!bugunMenu || bugunMenu.ogle.length === 0) {
      console.log('Bugün menü yok, bildirim gönderilmedi.');
      return;
    }

    const bugunYemekler = bugunMenu.ogle.map(y => y.ad.toLowerCase());
    console.log('Bugünün yemekleri:', bugunYemekler);

    // Supabase'den tüm bildirimleri çek
    const { data: bildirimler } = await db.from('bildirimler').select('*');
    if (!bildirimler || bildirimler.length === 0) {
      console.log('Kayıtlı bildirim yok.');
      return;
    }

    for (const bildirim of bildirimler) {
      const favori = bildirim.yemek_adi.toLowerCase();
      const eslesti = bugunYemekler.some(y => y.includes(favori) || favori.includes(y.split(' ')[0]));

      if (eslesti) {
        console.log(`${bildirim.eposta} adresine bildirim gönderiliyor: ${bildirim.yemek_adi}`);
        
        const yemekListesi = bugunMenu.ogle.map(y => 
          `<li><strong>${y.ad}</strong> ${y.kalori ? `- ${y.kalori} kcal` : ''}</li>`
        ).join('');

        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: bildirim.eposta,
          subject: `🍽️ Bugün ${bildirim.yemek_adi} var! - ÇÜ Yemekhane`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background: #C8102E; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">ÇÜ Yemekhane</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">Çukurova Üniversitesi</p>
              </div>
              <div style="background: #FDF0F2; padding: 20px; border-radius: 0 0 12px 12px;">
                <h2 style="color: #C8102E;">🎉 Favori yemeğin bugün var!</h2>
                <p>Merhaba! Favori yemeğin <strong>${bildirim.yemek_adi}</strong> bugün menüde!</p>
                <h3 style="color: #333;">Bugünün Menüsü:</h3>
                <ul style="line-height: 2;">${yemekListesi}</ul>
                <a href="https://cu-yemekhane.vercel.app" style="display: inline-block; background: #C8102E; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 10px;">Menüyü Gör →</a>
              </div>
            </div>
          `
        });

        console.log(`✅ ${bildirim.eposta} adresine gönderildi!`);
      }
    }

    console.log('Bildirimler tamamlandı!');
  } catch (error) {
    console.error('Bildirim hatası:', error.message);
  }
}

scrapeMenu();
