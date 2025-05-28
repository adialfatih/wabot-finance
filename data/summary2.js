async function kirimLaporanBulanan(nomor, nomorBersih, bulan, tahun, jenis = null) {
  const nomorBulan = String(bulan).padStart(2, '0');
  const startDate = `${tahun}-${nomorBulan}-01`;
  const endDate = `${tahun}-${nomorBulan}-31`;
  const namaBulan = new Date(`${tahun}-${nomorBulan}-01`).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  if (!jenis || jenis === 'in') {
    db.query(
      `SELECT SUM(nominal) AS total_in FROM table_pemasukan WHERE nomor = ? AND tanggal BETWEEN ? AND ?`,
      [nomorBersih, startDate, endDate],
      async (errIn, resultIn) => {
        if (errIn) {
          console.error('❌ Gagal ambil pemasukan:', errIn);
          await client.sendMessage(nomor, '❌ Gagal mengambil data pemasukan.');
          return;
        }

        const pemasukan = resultIn[0].total_in || 0;
        let teks = `📥 *Laporan Pemasukan - ${namaBulan}*\n\n💰 Total: Rp ${pemasukan.toLocaleString('id-ID')}`;
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
    );
  }

  if (!jenis || jenis === 'out') {
    db.query(
      `SELECT SUM(nominal) AS total_out FROM table_pengeluaran WHERE nomor = ? AND tanggal BETWEEN ? AND ?`,
      [nomorBersih, startDate, endDate],
      async (errOut, resultOut) => {
        if (errOut) {
          console.error('❌ Gagal ambil pengeluaran:', errOut);
          await client.sendMessage(nomor, '❌ Gagal mengambil data pengeluaran.');
          return;
        }

        const pengeluaran = resultOut[0].total_out || 0;
        let teks = `📤 *Laporan Pengeluaran - ${namaBulan}*\n\n💸 Total: Rp ${pengeluaran.toLocaleString('id-ID')}`;
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
    );
  }

  if (!jenis) {
    const totalQuery = `
      SELECT 
        (SELECT SUM(nominal) FROM table_pemasukan WHERE nomor = ? AND tanggal BETWEEN ? AND ?) AS pemasukan,
        (SELECT SUM(nominal) FROM table_pengeluaran WHERE nomor = ? AND tanggal BETWEEN ? AND ?) AS pengeluaran
    `;
    db.query(totalQuery, [nomorBersih, startDate, endDate, nomorBersih, startDate, endDate], async (err, result) => {
      if (!err && result.length > 0) {
        const pemasukan = result[0].pemasukan || 0;
        const pengeluaran = result[0].pengeluaran || 0;
        const net = pemasukan - pengeluaran;
        const teks = `💡 *Selisih Bulan Ini* (${namaBulan})\n\n💰 Pemasukan: Rp ${pemasukan.toLocaleString('id-ID')}\n💸 Pengeluaran: Rp ${pengeluaran.toLocaleString('id-ID')}\n💎 Net Balance: Rp ${net.toLocaleString('id-ID')}`;
        await client.sendMessage(nomor, teks);
      }
    });
  }
}




if (isiLower === 'summary') {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  await kirimLaporanBulanan(nomor, nomorBersih, bulan, tahun);
  return;
}





const match = isiLower.match(/\b(in\s+|out\s+)?(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i);
if (match) {
  const jenis = match[1]?.trim(); // 'in' | 'out' | undefined
  const namaBulan = match[2];
  const tahun = parseInt(match[3]);

  const bulanMap = {
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
  };
  const bulan = bulanMap[namaBulan];

  await kirimLaporanBulanan(nomor, nomorBersih, bulan, tahun, jenis);
  return;
}
