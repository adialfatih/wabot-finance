const express = require('express');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia  } = require('whatsapp-web.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const ChartDataLabels = require('chartjs-plugin-datalabels');
const qrcode = require('qrcode');
const path = require('path');
const db = require('./db');
require('dotenv').config();
const puppeteer = require('puppeteer');
const getRandomMotivation = require('./utils/getDailyMotivation');

const app = express();
const port = process.env.PORT || 3000;

// Express Setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let qrCodeImage = null;
let isAuthenticated = false;

const SESSION_DIR = './sessions/';
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

// WhatsApp Client
let client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    executablePath: puppeteer.executablePath(), // Pakai browser bawaan Puppeteer
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', async (qr) => {
    console.log('📸 QR received');
    qrCodeImage = await qrcode.toDataURL(qr);
    isAuthenticated = false;
});

client.on('ready', () => {
  console.log('✅ WhatsApp Ready!');
  isAuthenticated = true;
  logToFile('WhatsApp Client is ready!');
});


client.on('disconnected', (reason) => {
    console.log('Client disconnected due to:', reason);
    client.initialize(); // Reconnect
});


client.on('authenticated', () => {
  console.log('🔐 Authenticated');
});

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 500, height: 500, plugins: { modern: ['chartjs-plugin-datalabels'] } });

async function generatePieChartByCategory(nomor, tanggal, labels, data, tipe, tglshow) {
  const configuration = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: labels.map(() => getRandomColor())
      }]
    },
    options: {
      plugins: {
        datalabels: {
          formatter: (value, ctx) => {
            //const data = rows.map(row => Number(row.total));
            const dataArr = ctx.chart.data.datasets[0].data;
            const total = dataArr.reduce((a, b) => a + b, 0);
            const percentage = (value / total * 100).toFixed(1) + "%";
            return percentage;
          },
          color: '#fff',
          font: {
            weight: 'bold',
            size: 18
          }
        },
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: `Kategori ${tipe} (${tglshow})`
        }
      }
    }
  };

  const fileName = `./public/pie_${tipe}_kategori_${nomor}_${tanggal}.png`;
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  fs.writeFileSync(fileName, buffer);
  return fileName;
}

// Fungsi tambahan untuk menghasilkan warna acak
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}


const userSession = {};
client.on('message', async msg => {
  console.log('📩 Message Received:', msg.body);
  
  logToFile(`Received message: ${msg.body}`);
  // ⬇️ Tambahan: Simpan ke database
  const nomor = msg.from;
  const nomorBersih = nomor.split('@')[0]; // hasil: 6289651253545
  const isi_pesan = msg.body;
  const isiLower = isi_pesan.toLowerCase();
  const now = new Date();
  const tanggal = now.toISOString().split('T')[0];
  const jam = now.toTimeString().split(' ')[0];
  if (isiLower === 'info') {
    const motivation = getRandomMotivation();
    const menuText = `📌 *Asisten Keuangan Pribadi* \n \nHai! Terima kasih telah menggunakan layanan ini.\nAplikasi ini dibuat dan di kembangkan oleh Grafamedia Software Development And Digital Product. \n\n🔒 Semua data keuangan yang kamu catat bersifat *PRIVAT*, *RAHASIA*, dan *TERENKRIPSI* dengan baik agar hanya kamu sendiri yang bisa mengakses dan melihatnya. Kami menjaga data kamu dengan sepenuh hati ❤️\n \n🤖 Aplikasi ini dibuat *gratis* oleh *Grafamedia* sebagai kontribusi kami untuk membantu masyarakat mengelola keuangan dengan mudah dan aman. \n \n🙏 Jika kamu merasa terbantu dan ingin mendukung pengembangan aplikasi ini, kami sangat senang dan terbuka menerima *donasi sukarela*. 😊 \n\n *#TerimaKasih #JagaKeuangan #AmanBersamaGrafamedia*`;
    const menuText2 = `💡 *Motivasi Keuangan Hari Ini*:\n \n"*${motivation}*" \n \nSetiap pengeluaran adalah pilihan. Dengan mencatat dan merencanakan keuangan, kamu sedang menyiapkan masa depan yang lebih tenang, bebas dari stres, dan penuh peluang. Ingat, bukan seberapa besar penghasilanmu, tapi seberapa bijak kamu mengaturnya.`;
    await client.sendMessage(nomor, menuText2);
    await client.sendMessage(nomor, menuText);
    return;
  }
  if (isiLower === 'summary') {
    const menuText = 'Laporan bulanan akan tersedia setelah anda melakukan catat pemasukan dan pengeluaran lebih dari 14 hari. ';
    await client.sendMessage(nomor, menuText);
    return;
  }
  db.query(
    'INSERT INTO log_terima_pesan (nomor, isi_pesan, tanggal, jam) VALUES (?, ?, ?, ?)',
    [nomor, isi_pesan, tanggal, jam],
    (err, result) => {
      if (err) {
        console.error('❌ Gagal simpan ke DB:', err);
        logToFile('Gagal simpan ke DB: ' + err.message);
      } else {
        console.log('✅ Pesan berhasil disimpan ke database');
      }
    }
  );
    // 🔍 Cek apakah nomor sudah terdaftar
    //const sudahTerdaftar = result.length > 0;
    db.query('SELECT * FROM table_user WHERE nomor_user = ?', [nomorBersih], async (err, results) => {
        if (err) {
          console.error('❌ Gagal cek user:', err);
          return;
        }
      
        const sudahTerdaftar = results.length > 0;
      
        if (!sudahTerdaftar) {
          // 👉 Jika user belum daftar dan sedang input nama
          if (userSession[nomorBersih]?.stage === 'input_nama') {
            const nama_user = isi_pesan;
            db.query(
              'INSERT INTO table_user (nomor_user, nama_user, tanggal_daftar, jam_daftar) VALUES (?, ?, ?, ?)',
              [nomorBersih, nama_user, tanggal, jam],
              async (err) => {
                if (err) {
                  console.error('❌ Gagal simpan user baru:', err);
                  await client.sendMessage(nomor, 'Maaf, terjadi kesalahan saat menyimpan data Anda.');
                } else {
                  delete userSession[nomorBersih]; // hapus sesi
                  await client.sendMessage(nomor, `Hi, ${nama_user}, selamat ya pendaftaran mu telah berhasil. 😊\nketik *Help* untuk mendapat bantuan`);
                }
              }
            );
            return;
          }
      
          // 👉 Jika user ketik "daftar"
          if (isiLower === 'daftar') {
            userSession[nomorBersih] = { stage: 'input_nama' };
            await client.sendMessage(nomor, 'Silahkan ketik nama anda');
            return;
          }
      
          // 👉 Balasan default untuk user belum daftar
          await client.sendMessage(nomor, 'Halo, selamat datang di Asisten Keuangan Pribadi mu. ketik *Daftar* untuk mendaftarkan nomor anda.');
          return;
        }
      
        // ❗Jika sudah terdaftar → lanjut ke perintah lain
        const nama_user = results[0].nama_user;

        if (isiLower === 'menu' || isiLower === 'help') {
        const menuText = `📋 *MENU BANTUAN* 📋\n1. Untuk catat pemasukan ketik: *IN nominal jenis_pemasukan keterangan* \n2. Untuk catat pengeluaran ketik: *OUT nominal jenis_pengeluaran keterangan* \n3. Untuk hapus data ketik: *Hapusin / Hapusout* \n4. Ketik *TODAY* untuk melihat pemasukan dan pengeluaran hari ini. \n5. Ketik *OUT TODAY* untuk melihat pengeluaran hari ini. \n6. Ketik *IN TODAY* untuk melihat pemasukan hari ini. \n7. Ketik nama bulan dan tahun. Contoh: *Maret 2025* untuk melihat laporan bulan itu. \n8. Ketik *IN Maret 2025* untuk laporan pemasukan. \n9. Ketik *OUT Maret 2025* untuk laporan pengeluaran.\n10. Ketik *SUMMARY* Untuk melihat laporan bulan ini. \n \nKetik *Help* kapan pun untuk melihat menu ini kembali.\nKetik *Info* untuk informasi tentang aplikasi ini.
        `;
        await client.sendMessage(nomor, menuText);
        return;
        }
        
        //tangani today
        if (isiLower === 'today') {
          const today2 = new Date();
          const yesterday = new Date(today2);
          yesterday.setDate(today2.getDate() - 1);
          //const todayStr = today2.toISOString().split('T')[0];
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          //console.log('Hari ini:', todayStr);
          //console.log('Kemarin:', yesterdayStr);

          const today = new Date().toISOString().split('T')[0];
          const todayDate = new Date();
          const dd = String(todayDate.getDate()).padStart(2, '0');
          const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
          const yyyy = todayDate.getFullYear();
          const formattedDate = `${dd}/${mm}/${yyyy}`; // contoh: 10/04/2025
        
          const queryIn = `SELECT SUM(nominal) AS total_in FROM table_pemasukan WHERE nomor = ? AND tanggal = ?`;
          const queryInBefore = `SELECT SUM(nominal) AS total_in FROM table_pemasukan WHERE nomor = ? AND tanggal = ?`;
          const queryOut = `SELECT SUM(nominal) AS total_out FROM table_pengeluaran WHERE nomor = ? AND tanggal = ?`;
          const queryOutBefore = `SELECT SUM(nominal) AS total_out FROM table_pengeluaran WHERE nomor = ? AND tanggal = ?`;
        
              db.query(queryIn, [nomorBersih, today], (errIn, resultIn) => {
              if (errIn) {
                console.error('❌ Gagal ambil pemasukan:', errIn);
                msg.reply('❌ Gagal mengambil data pemasukan.');
                return;
              }
        
              db.query(queryOut, [nomorBersih, today], async (errOut, resultOut) => {
              if (errOut) {
                console.error('❌ Gagal ambil pengeluaran:', errOut);
                msg.reply('❌ Gagal mengambil data pengeluaran.');
                return;
              }
                db.query(queryInBefore, [nomorBersih, yesterdayStr], async (errInBefore, resultInBefore) => {
                if (errInBefore) {
                  console.error('❌ Gagal ambil pengeluaran hari sebelumnya :', errInBefore);
                  //msg.reply('❌ Gagal mengambil data pengeluaran.');
                  return;
                }
                  db.query(queryOutBefore, [nomorBersih, yesterdayStr], async (errOutBefore, resultOutBefore) => {
                  if (errOutBefore) {
                    console.error('❌ Gagal ambil pengeluaran hari sebelumnya:', errOutBefore);
                    //msg.reply('❌ Gagal mengambil data pengeluaran.');
                    return;
                  }
        
                const pemasukansebelum = resultInBefore[0].total_in || 0;
                const pemasukan = resultIn[0].total_in || 0;
                const pengeluaran = resultOut[0].total_out || 0;
                const pengeluaransebelum = resultOutBefore[0].total_out || 0;
                const pemasukanNum = Number(pemasukan);
                const pemasukanNumBefore = Number(pemasukansebelum);
                const pengeluaranBefore = Number(pengeluaransebelum);
                const pengeluaranNum = Number(pengeluaran);
                const netBalance = pemasukanNum - pengeluaranNum;
                //const persenIn = total > 0 ? Math.round((pemasukan / total) * 100) : 0;
                //const persenOut = 100 - persenIn;
                //const persenPemasukan = Math.round((pemasukanNum / total) * 100);
                //const persenPengeluaran = Math.round((pengeluaranNum / total) * 100);
                //const chartPath = await generatePieChart(nomorBersih, today, pemasukanNum, pengeluaranNum);
                //const media = MessageMedia.fromFilePath(chartPath);
                const summary = `📊 *Laporan Hari Ini* (${formattedDate}) \n \n💰 Total In: Rp ${pemasukanNum.toLocaleString('id-ID')} \n💥 Total Out: Rp ${pengeluaranNum.toLocaleString('id-ID')}\n💎 Net Balance: Rp ${netBalance.toLocaleString('id-ID')}`;
                await client.sendMessage(nomor, summary);
                //await client.sendMessage(nomor, media);
                  if(pemasukanNumBefore < pemasukanNum){
                      const thistxt = `🥳 Pemasukan hari ini lebih besar dari hari kemarin.`;
                      await client.sendMessage(nomor, thistxt);
                  }
                  if(pemasukanNumBefore > pemasukanNum){
                      const thistxt = `🥺 Pemasukan hari ini lebih kecil daripada hari kemarin.`;
                      await client.sendMessage(nomor, thistxt);
                  }
                  if(pengeluaranBefore < pengeluaranNum){
                      const thistxt = `🥺 Pengeluaran hari ini lebih besar daripada hari kemarin.`;
                      await client.sendMessage(nomor, thistxt);
                  }
                  if(pengeluaranBefore > pengeluaranNum){
                      const thistxt = `🥳 Pengeluaran hari ini lebih kecil dari hari kemarin.`;
                      await client.sendMessage(nomor, thistxt);
                  }
                  if(pengeluaranBefore == pengeluaranNum){
                      const thistxt = `😁 Pengeluaran anda stabil 👍`;
                      await client.sendMessage(nomor, thistxt);
                  }
                  if(pemasukanNumBefore == pemasukanNum){
                      const thistxt = `😁 Pemasukan anda stabil 👍`;
                      await client.sendMessage(nomor, thistxt);
                  }
              });
              });
            });
          });
        
          return;
        }
        
        //end today
        // Tangani perintah lainnya (sementara nanti bisa ditambah IN, OUT, dsb)
        const knownCommands = [
        'halo', 'today', 'in today', 'out today'
        ];
        if (isiLower === 'halo' || isiLower === 'hi' || isiLower === 'hello') {
          await client.sendMessage(nomor, `${isiLower} juga ${nama_user}, apakah kamu butuh bantuan? 😊\nKetik *Help* untuk melihat bantuan.`);
          return;
        }

        //if (isiLower.startsWith('hapusin ')) {
            //console.log('tes');
            if (/^hapusin\s+#\d+$/i.test(isiLower)) {
              const idTarget = isi_pesan.match(/#(\d+)/)[1];
            
              db.query(
                'DELETE FROM table_pemasukan WHERE id = ? AND nomor = ?',
                [idTarget, nomorBersih],
                async (err, result) => {
                  if (err) {
                    console.error('❌ Gagal hapus data ID:', err.message);
                    await msg.reply('❌ Gagal menghapus data pemasukan.');
                  } else if (result.affectedRows === 0) {
                    await msg.reply('⚠️ Data tidak ditemukan atau bukan milik Anda.');
                  } else {
                    await msg.reply(`🗑️ Data dengan ID *#${idTarget}* berhasil dihapus.`);
                  }
                }
              );
              return;
            }
            //hapus id #number
            if (/^hapusin\s+\d{2}\/\d{2}\/\d{4}$/i.test(isiLower)) {
              const parts = isi_pesan.trim().split(' ')[1].split('/');
              const tanggalCari = `${parts[2]}-${parts[1]}-${parts[0]}`;
            
              db.query(
                'SELECT * FROM table_pemasukan WHERE nomor = ? AND tanggal = ? ORDER BY jam DESC',
                [nomorBersih, tanggalCari],
                async (err, rows) => {
                  if (err) {
                    console.error('❌ Gagal ambil data hapusin tanggal:', err);
                    await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                    return;
                  }
            
                  if (rows.length === 0) {
                    await msg.reply(`📭 Tidak ada pemasukan pada tanggal ${parts.join('/')}`);
                    return;
                  }
            
                  let teks = `🗑️ *Data Pemasukan ${parts.join('/')}*\n\n`;
                  rows.forEach(row => {
                    teks += `#${row.id} - Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
                  });
                  teks += `\nKetik *HAPUSIN #id* untuk menghapus salah satu.`;
            
                  await msg.reply(teks);
                }
              );
              return;
            }
            //hapusin tanggal show
            if (isiLower === 'hapusin') {
              const today = new Date().toISOString().split('T')[0];
            
              db.query(
                'SELECT * FROM table_pemasukan WHERE nomor = ? AND tanggal = ? ORDER BY jam DESC',
                [nomorBersih, today],
                async (err, rows) => {
                  if (err) {
                    console.error('❌ Gagal ambil data hapusin today:', err);
                    await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                    return;
                  }
            
                  if (rows.length === 0) {
                    await msg.reply('📭 Tidak ada pemasukan hari ini.');
                    return;
                  }
            
                  let teks = `🗑️ *Data Pemasukan Hari Ini*\n\n`;
                  rows.forEach(row => {
                    teks += `#${row.id} - Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
                  });
                  teks += `\nKetik *HAPUSIN #id* untuk menghapus salah satu. \nKetik *HAPUSIN dd/mm/yyyy* untuk menghapus pemasukan pada tanggal tsb.`;
            
                  await msg.reply(teks);
                }
              );
              return;
            }
            //end hapusin
        //}
        //end perintah hapusin 
        //if (isiLower.startsWith('hapusout ')) {
            //console.log('tes');
            if (/^hapusout\s+#\d+$/i.test(isiLower)) {
              const idTarget = isi_pesan.match(/#(\d+)/)[1];
            
              db.query(
                'DELETE FROM table_pengeluaran WHERE id = ? AND nomor = ?',
                [idTarget, nomorBersih],
                async (err, result) => {
                  if (err) {
                    console.error('❌ Gagal hapus data ID:', err.message);
                    await msg.reply('❌ Gagal menghapus data pengeluaran.');
                  } else if (result.affectedRows === 0) {
                    await msg.reply('⚠️ Data tidak ditemukan atau bukan milik Anda.');
                  } else {
                    await msg.reply(`🗑️ Data dengan ID *#${idTarget}* berhasil dihapus.`);
                  }
                }
              );
              return;
            }
            //hapus out id #number
            if (/^hapusout\s+\d{2}\/\d{2}\/\d{4}$/i.test(isiLower)) {
              const parts = isi_pesan.trim().split(' ')[1].split('/');
              const tanggalCari = `${parts[2]}-${parts[1]}-${parts[0]}`;
            
              db.query(
                'SELECT * FROM table_pengeluaran WHERE nomor = ? AND tanggal = ? ORDER BY jam DESC',
                [nomorBersih, tanggalCari],
                async (err, rows) => {
                  if (err) {
                    console.error('❌ Gagal ambil data hapusOUT tanggal:', err);
                    await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                    return;
                  }
            
                  if (rows.length === 0) {
                    await msg.reply(`📭 Tidak ada Pengeluaran pada tanggal ${parts.join('/')}`);
                    return;
                  }
            
                  let teks = `🗑️ *Data Pengeluaran ${parts.join('/')}*\n\n`;
                  rows.forEach(row => {
                    teks += `#${row.id} - Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
                  });
                  teks += `\nKetik *HAPUSOUT #id* untuk menghapus salah satu.`;
            
                  await msg.reply(teks);
                }
              );
              return;
            }
            //hapusin tanggal show
            if (isiLower === 'hapusout') {
              const today = new Date().toISOString().split('T')[0];
            
              db.query(
                'SELECT * FROM table_pengeluaran WHERE nomor = ? AND tanggal = ? ORDER BY jam DESC',
                [nomorBersih, today],
                async (err, rows) => {
                  if (err) {
                    console.error('❌ Gagal ambil data hapusout today:', err);
                    await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                    return;
                  }
            
                  if (rows.length === 0) {
                    await msg.reply('📭 Tidak ada Pengeluaran hari ini.');
                    return;
                  }
            
                  let teks = `🗑️ *Data Pengeluaran Hari Ini*\n\n`;
                  rows.forEach(row => {
                    teks += `#${row.id} - Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
                  });
                  teks += `\nKetik *HAPUSOUT #id* untuk menghapus salah satu. \nKetik *HAPUSOUT dd/mm/yyyy* untuk menghapus pengeluaran pada tanggal tsb.`;
            
                  await msg.reply(teks);
                }
              );
              return;
            }
            //end hapusout
        //}
        //end perintah hapusout
        // Handler untuk "Maret 2025", "IN Maret 2025", "OUT Maret 2025"
          const bulanRegex = /\b(in\s+|out\s+)?(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i;
          const match = isiLower.match(bulanRegex);

          if (match) {
            const jenisLaporan = match[1]?.trim(); // 'in', 'out' atau undefined
            const namaBulan = match[2];
            const tahun = parseInt(match[3]);

            const namaBulanToNumber = {
              januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
              juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
            };

            const bulan = namaBulanToNumber[namaBulan];

            if (!bulan) {
              await msg.reply('❌ Bulan tidak dikenali. Gunakan format seperti: *Maret 2025*');
              return;
            }

            const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
            const endDate = `${tahun}-${String(bulan).padStart(2, '0')}-31`; // aman karena query pakai BETWEEN
            const menuText = 'Laporan bulanan akan tersedia setelah anda melakukan catat pemasukan dan pengeluaran lebih dari 14 hari. ';
            if (!jenisLaporan) {
              // Laporan gabungan pemasukan dan pengeluaran
              //await sendLaporanBulanan(nomor, nomorBersih, nama_user, startDate, endDate);
              const tes = `bulan laporan ${nama_user} - ${startDate} - ${endDate}`;
              await client.sendMessage(nomor, menuText);
            } else if (jenisLaporan === 'in') {
              const tes = `bulan laporan in ${nama_user} - ${startDate} - ${endDate}`;
              await client.sendMessage(nomor, menuText);
            } else if (jenisLaporan === 'out') {
              const tes = `bulan laporan out ${nama_user} - ${startDate} - ${endDate}`;
              await client.sendMessage(nomor, menuText);
            }
            return;
          }
        // Jika bukan perintah yang dikenali dan bukan pola yang ditangani
        if (
        !knownCommands.includes(isiLower) &&
        !isiLower.startsWith('in ') &&
        !isiLower.startsWith('out ') &&
        !isiLower.startsWith('in today') &&
        !/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b.*\d{4}/i.test(isiLower)
        ) {
        await client.sendMessage(nomor, `Maaf ya ${nama_user}, apakah kamu butuh bantuan? 😊\nKetik *Help* untuk melihat bantuan.`);
        return;
        }

        // Tambahkan di sini fungsi lanjut IN / OUT / TODAY sesuai kebutuhan
        // ✅ Tampilkan pemasukan dan pengeluaran HARI INI
        if (isiLower === 'in today') {
          const today = new Date().toISOString().split('T')[0]; // format: YYYY-MM-DD
          //const isoToday = now.toISOString().split('T')[0]; // yyyy-mm-dd
          const today2 = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;


          db.query(
            'SELECT * FROM table_pemasukan WHERE nomor = ? AND tanggal = ? ORDER BY id',
            [nomorBersih, today],
            async (err, rows) => {
              if (err) {
                console.error('❌ Gagal ambil data pemasukan today:', err);
                await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                return;
              }

              if (rows.length === 0) {
                await msg.reply('📭 Tidak ada pemasukan hari ini.');
                return;
              }

              let teks = `📥 *Pemasukan Hari Ini* (${today2})\n\n`;
              let total = 0;
              rows.forEach((row, i) => {
                total += row.nominal;
                teks += `#${i + 1}. Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
              });
              teks += `\n💰 Total: *Rp${total.toLocaleString()}*`;
              await msg.reply(teks);
            }
          );
          db.query(
            'SELECT jenis, SUM(nominal) AS total FROM table_pemasukan WHERE nomor = ? AND tanggal = ? GROUP BY jenis',
            [nomorBersih, today],
            async (err, rows) => {
              if (err) {
                console.error('❌ Gagal ambil data Pemasukan today:', err);
                await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                //return;
              }
        
              if (rows.length === 0) {
                //await msg.reply('📭 Tidak ada pengeluaran hari ini.');
                //return;
              } else { 
              const labels = rows.map(row => row.jenis);
              //const data = rows.map(row => row.total);
              const data = rows.map(row => Number(row.total));
              const tipe1= 'Pemasukan';
              // Buat pie chart berdasarkan kategori pengeluaran
              const chartPath = await generatePieChartByCategory(nomorBersih, today, labels, data, tipe1, today2);
              const media = MessageMedia.fromFilePath(chartPath);
              await client.sendMessage(nomor, media); }
            }
          );
          return;
        }
        if (isiLower === 'out today') {
          const today = new Date().toISOString().split('T')[0]; // format: YYYY-MM-DD
          const today2 = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

          db.query(
            'SELECT * FROM table_pengeluaran WHERE nomor = ? AND tanggal = ? ORDER BY id',
            [nomorBersih, today],
            async (err, rows) => {
              if (err) {
                console.error('❌ Gagal ambil data pengeluaran today:', err);
                await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                return;
              }

              if (rows.length === 0) {
                await msg.reply('📭 Tidak ada pengeluaran hari ini.');
                return;
              }

              let teks = `📤 *Pengeluaran Hari Ini* (${today})\n\n`;
              let total = 0;
              rows.forEach((row, i) => {
                total += row.nominal;
                teks += `#${i + 1}. Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
              });
              teks += `\n💰 Total: *Rp${total.toLocaleString()}*`;
              await msg.reply(teks);
            }
          );
          db.query(
            'SELECT jenis, SUM(nominal) AS total FROM table_pengeluaran WHERE nomor = ? AND tanggal = ? GROUP BY jenis',
            [nomorBersih, today],
            async (err, rows) => {
              if (err) {
                console.error('❌ Gagal ambil data pengeluaran today:', err);
                await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
                //return;
              }
        
              if (rows.length === 0) {
                //await msg.reply('📭 Tidak ada pengeluaran hari ini.');
                //return;
              } else { 
              const labels = rows.map(row => row.jenis);
              //const data = rows.map(row => row.total);
              const data = rows.map(row => Number(row.total));
              const tipe1= 'Pengeluaran';
              // Buat pie chart berdasarkan kategori pengeluaran
              const chartPath = await generatePieChartByCategory(nomorBersih, today, labels, data, tipe1, today2);
              const media = MessageMedia.fromFilePath(chartPath);
              await client.sendMessage(nomor, media); }
            }
          );
          return;
        }
      //  end Tampilkan pemasukan pengeluaran HARI INI
      // ✅ Tampilkan pemasukan dan pengeluran by dd/mm/yyyy
      if (/^in\s+\d{2}\/\d{2}\/\d{4}$/.test(isiLower)) {
        const parts = isi_pesan.trim().split(' ')[1].split('/');
        const tanggalCari = `${parts[2]}-${parts[1]}-${parts[0]}`; // jadi: YYYY-MM-DD

        db.query(
          'SELECT * FROM table_pemasukan WHERE nomor = ? AND tanggal = ? ORDER BY id',
          [nomorBersih, tanggalCari],
          async (err, rows) => {
            if (err) {
              console.error('❌ Gagal ambil data pemasukan:', err);
              await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
              return;
            }

            if (rows.length === 0) {
              await msg.reply(`📭 Tidak ada pemasukan pada tanggal ${parts.join('/')}`);
              return;
            }

            let teks = `📥 *Pemasukan Tanggal ${parts.join('/')}*\n\n`;
            let total = 0;
            rows.forEach((row, i) => {
              total += row.nominal;
              teks += `#${i + 1}. Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
            });
            teks += `\n💰 Total: *Rp${total.toLocaleString()}*`;
            await msg.reply(teks);
          }
        );
        return;
      }
      if (/^out\s+\d{2}\/\d{2}\/\d{4}$/.test(isiLower)) {
        const parts = isi_pesan.trim().split(' ')[1].split('/');
        const tanggalCari = `${parts[2]}-${parts[1]}-${parts[0]}`; // jadi: YYYY-MM-DD

        db.query(
          'SELECT * FROM table_pengeluaran WHERE nomor = ? AND tanggal = ? ORDER BY id',
          [nomorBersih, tanggalCari],
          async (err, rows) => {
            if (err) {
              console.error('❌ Gagal ambil data pengeluaran:', err);
              await msg.reply('❌ Terjadi kesalahan saat mengambil data.');
              return;
            }

            if (rows.length === 0) {
              await msg.reply(`📭 Tidak ada pengeluaran pada tanggal ${parts.join('/')}`);
              return;
            }

            let teks = `📤 *Pengeluaran Tanggal ${parts.join('/')}*\n\n`;
            let total = 0;
            rows.forEach((row, i) => {
              total += row.nominal;
              teks += `#${i + 1}. Rp${row.nominal.toLocaleString()} - ${row.jenis}${row.keterangan ? ` - ${row.keterangan}` : ''}\n`;
            });
            teks += `\n💰 Total: *Rp${total.toLocaleString()}*`;
            await msg.reply(teks);
          }
        );
        return;
      }
      // end Tampilkan pemasukan dd/mm/yyyy

        if (isiLower.startsWith('in ')) {
            const potong = msg.body.trim().split(' ');
            potong.shift(); // buang kata "IN"
            
            const nominal = parseInt(potong[0]);
            const jenis_pemasukan = potong[1] ?? null;
            const keteranganArray = potong.slice(2);
            const keterangan = keteranganArray.length > 0 ? keteranganArray.join(' ') : null;
          
            if (isNaN(nominal) || !jenis_pemasukan) {
              await msg.reply('Format salah! Contoh: *IN 50000 Gaji Keterangan* (keterangan opsional)');
              return;
            }
          
            const now = new Date();
            const tanggal = now.toISOString().split('T')[0];
            const jam = now.toTimeString().split(' ')[0];
            //const nomorBersih = nomor.split('@')[0];
            db.query(
              `INSERT INTO table_pemasukan (nomor, nominal, jenis, keterangan, tanggal, jam)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [nomorBersih, nominal, jenis_pemasukan, keterangan, tanggal, jam],
              async function(err) {
                if (err) {
                  console.error('❌ Error insert pemasukan:', err.message);
                  await msg.reply('❌ Gagal menyimpan data pemasukan.');
                } else {
                  await msg.reply(`✅ Pemasukan sebesar *Rp${nominal.toLocaleString()}* telah dicatat.\nJenis: *${jenis_pemasukan}*\n${keterangan ? 'Keterangan: *' + keterangan + '*' : ''}`);
                }
              }
            );
          
            return;
          }
          //perintah IN end
          if (isiLower.startsWith('out ')) {
            const potong = msg.body.trim().split(' ');
            potong.shift(); // buang kata "out"
            
            const nominal = parseInt(potong[0]);
            const jenis_pemasukan = potong[1] ?? null;
            const keteranganArray = potong.slice(2);
            const keterangan = keteranganArray.length > 0 ? keteranganArray.join(' ') : null;
          
            if (isNaN(nominal) || !jenis_pemasukan) {
              await msg.reply('Format salah! \nContoh: \n1. *OUT 500000 Pokok Belanja bulanan* (keterangan opsional)\n2. *OUT 100000 Hutang bayar hutang ke dinda* \n3. *OUT 200000 hobby beli alat pancing*');
              return;
            }
          
            const now = new Date();
            const tanggal = now.toISOString().split('T')[0];
            const jam = now.toTimeString().split(' ')[0];
            //const nomorBersih = nomor.split('@')[0];
            db.query(
              `INSERT INTO table_pengeluaran (nomor, nominal, jenis, keterangan, tanggal, jam)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [nomorBersih, nominal, jenis_pemasukan, keterangan, tanggal, jam],
              async function(err) {
                if (err) {
                  console.error('❌ Error insert pengeluaran:', err.message);
                  await msg.reply('❌ Gagal menyimpan data pengeluaran.');
                } else {
                  await msg.reply(`✅ Pengeluaran sebesar *Rp${nominal.toLocaleString()}* telah dicatat.\nJenis: *${jenis_pemasukan}*\n${keterangan ? 'Keterangan: *' + keterangan + '*' : ''}`);
                }
              }
            );
          
            return;
          }
          //perintah OUT end
        
        

      });
  // Balasan otomatis dsb...

});

client.initialize();

// Routes
app.get('/', async (req, res) => {
  res.render('index', { qr: qrCodeImage, isAuthenticated });
  console.log('QR Image Data:', qrCodeImage);
});

app.post('/restart-session', (req, res) => {
  fs.rmdirSync(SESSION_DIR + 'Default', { recursive: true });
  qrCodeImage = null;
  isAuthenticated = false;
  client.destroy().then(() => {
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
      puppeteer: { headless: true }
    });
    client.initialize();
    res.redirect('/');
  });
});

app.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) return res.send('Error');
    res.json(results);
  });
});

app.get('/logs', (req, res) => {
  fs.readFile('./logs/system.log', 'utf8', (err, data) => {
    if (err) return res.send('Error');
    res.type('text/plain').send(data);
  });
});

// Helper log
function logToFile(msg) {
  fs.appendFileSync('./logs/system.log', `[${new Date().toISOString()}] ${msg}\n`);
}

app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
