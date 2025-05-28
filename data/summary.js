async function kirimLaporanBulanan(nomor, nomorBersih, bulan, tahun, jenis = null) {
  const nomorBulan = String(bulan).padStart(2, '0');
  const startDate = `${tahun}-${nomorBulan}-01`;
  const endDate = `${tahun}-${nomorBulan}-31`;
  const namaBulan = new Date(tahun, bulan - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  if (!jenis || jenis === 'in') {
    // total pemasukan
    db.query(
      `SELECT SUM(nominal) AS total_in FROM table_pemasukan WHERE nomor = ? AND tanggal BETWEEN ? AND ?`,
      [nomorBersih, startDate, endDate],
      async (err, resultIn) => {
        if (err) {
          console.error('❌ Gagal ambil pemasukan:', err);
          await client.sendMessage(nomor, '❌ Gagal ambil data pemasukan.');
          return;
        }

        const pemasukan = resultIn[0].total_in || 0;

        if (jenis === 'in') {
          let teks = `📥 *Laporan Pemasukan* (${namaBulan})\n\n`;
          teks += `💰 Total Pemasukan: Rp ${pemasukan.toLocaleString('id-ID')}`;
          await client.sendMessage(nomor, teks);

          db.query(
            `SELECT jenis, SUM(nominal) AS total FROM table_pemasukan WHERE nomor = ? AND tanggal BETWEEN ? AND ? GROUP BY jenis`,
            [nomorBersih, startDate, endDate],
            async (err, rows) => {
              if (!err && rows.length > 0) {
                const labels = rows.map(r => r.jenis);
                const data = rows.map(r => Number(r.total));
                const chartPath = await generatePieChartByCategory(nomorBersih, `${tahun}${nomorBulan}`, labels, data, 'Pemasukan', namaBulan);
                const media = MessageMedia.fromFilePath(chartPath);
                await client.sendMessage(nomor, media);
              }
            }
          );
        }
      }
    );
  }

  if (!jenis || jenis === 'out') {
    // total pengeluaran
    db.query(
      `SELECT SUM(nominal) AS total_out FROM table_pengeluaran WHERE nomor = ? AND tanggal BETWEEN ? AND ?`,
      [nomorBersih, startDate, endDate],
      async (err, resultOut) => {
        if (err) {
          console.error('❌ Gagal ambil pengeluaran:', err);
          await client.sendMessage(nomor, '❌ Gagal ambil data pengeluaran.');
          return;
        }

        const pengeluaran = resultOut[0].total_out || 0;

        if (jenis === 'out') {
          let teks = `📤 *Laporan Pengeluaran* (${namaBulan})\n\n`;
          teks += `💸 Total Pengeluaran: Rp ${pengeluaran.toLocaleString('id-ID')}`;
          await client.sendMessage(nomor, teks);

          db.query(
            `SELECT jenis, SUM(nominal) AS total FROM table_pengeluaran WHERE nomor = ? AND tanggal BETWEEN ? AND ? GROUP BY jenis`,
            [nomorBersih, startDate, endDate],
            async (err, rows) => {
              if (!err && rows.length > 0) {
                const labels = rows.map(r => r.jenis);
                const data = rows.map(r => Number(r.total));
                const chartPath = await generatePieChartByCategory(nomorBersih, `${tahun}${nomorBulan}`, labels, data, 'Pengeluaran', namaBulan);
                const media = MessageMedia.fromFilePath(chartPath);
                await client.sendMessage(nomor, media);
              }
            }
          );
        }

        // Jika gabungan (in + out)
        if (!jenis) {
          db.query(
            `SELECT SUM(nominal) AS total_in FROM table_pemasukan WHERE nomor = ? AND tanggal BETWEEN ? AND ?`,
            [nomorBersih, startDate, endDate],
            async (err2, resultIn) => {
              if (err2) return;
              const pemasukan = resultIn[0].total_in || 0;
              const net = pemasukan - pengeluaran;

              let teks = `📊 *Ringkasan Keuangan* (${namaBulan})\n\n`;
              teks += `💰 Total Pemasukan: Rp ${pemasukan.toLocaleString('id-ID')}\n`;
              teks += `💸 Total Pengeluaran: Rp ${pengeluaran.toLocaleString('id-ID')}\n`;
              teks += `💎 Selisih: Rp ${net.toLocaleString('id-ID')}`;
              await client.sendMessage(nomor, teks);
            }
          );

          // Grafik gabungan
          db.query(
            `SELECT jenis, SUM(nominal) AS total FROM table_pemasukan WHERE nomor = ? AND tanggal BETWEEN ? AND ? GROUP BY jenis`,
            [nomorBersih, startDate, endDate],
            async (err, rows) => {
              if (!err && rows.length > 0) {
                const labels = rows.map(r => r.jenis);
                const data = rows.map(r => Number(r.total));
                const chartPath = await generatePieChartByCategory(nomorBersih, `${tahun}${nomorBulan}`, labels, data, 'Pemasukan', namaBulan);
                const media = MessageMedia.fromFilePath(chartPath);
                await client.sendMessage(nomor, media);
              }
            }
          );

          db.query(
            `SELECT jenis, SUM(nominal) AS total FROM table_pengeluaran WHERE nomor = ? AND tanggal BETWEEN ? AND ? GROUP BY jenis`,
            [nomorBersih, startDate, endDate],
            async (err, rows) => {
              if (!err && rows.length > 0) {
                const labels = rows.map(r => r.jenis);
                const data = rows.map(r => Number(r.total));
                const chartPath = await generatePieChartByCategory(nomorBersih, `${tahun}${nomorBulan}`, labels, data, 'Pengeluaran', namaBulan);
                const media = MessageMedia.fromFilePath(chartPath);
                await client.sendMessage(nomor, media);
              }
            }
          );
        }
      }
    );
  }
}




if (isiLower === 'summary') {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  await kirimLaporanBulanan(nomor, nomorBersih, bulan, tahun);
  return;
}




if (!jenisLaporan) {
  const tes = `bulan laporan ${nama_user} - ${startDate} - ${endDate}`;
  await client.sendMessage(nomor, menuText);
} else if (jenisLaporan === 'in') {
  const tes = `bulan laporan in ${nama_user} - ${startDate} - ${endDate}`;
  await client.sendMessage(nomor, menuText);
} else if (jenisLaporan === 'out') {
  const tes = `bulan laporan out ${nama_user} - ${startDate} - ${endDate}`;
  await client.sendMessage(nomor, menuText);
}


await kirimLaporanBulanan(nomor, nomorBersih, bulan, tahun, jenisLaporan);
