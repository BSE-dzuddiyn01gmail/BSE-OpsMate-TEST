// Real-message field test derived from observed BSE operational message patterns.
// TEST-only. No production writer or external action.

function runBseRealMessageFieldTests(){
  const tests=[];
  const ok=(id,pass,detail)=>tests.push({id:id,pass:!!pass,detail:detail||''});

  let r=bseInventoryParseMessage_('Minyak Petrol RM 50.00','2026-09-21T04:00:00.000Z');
  bseInventoryApplyReporterSnapshot_(r,{reporterTelegramUserId:'77',reporterName:'Zainal',reporterUsername:'zainal'});
  let f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('claim natural + sender claimant',r&&r.validation==='PASS'&&f.amount_myr===50&&f.claimant==='Zainal'&&f.quantity==null&&f.unit==null);

  r=bseInventoryParseMessage_('17/09/2026 Baja In 4 Set F','2026-09-17T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('Baja In 4 Set F',r&&r.validation==='PASS'&&f.record_type==='INVENTORY_IN'&&f.item_name==='Fruitka'&&f.quantity===4&&f.unit==='set'&&f.event_date==='2026-09-17');

  r=bseInventoryParseMessage_('M3 P1 P2 11/9/2026 F N','2026-09-11T04:00:00.000Z');
  const rows=(r&&r.candidates||[]).map(c=>c.fields);
  ok('F + N split across two plots',r&&r.validation==='PASS'&&rows.length===4&&
    ['Fruitka@M3P1','Fruitka@M3P2','Benegro N@M3P1','Benegro N@M3P2'].every(key=>rows.some(x=>x.item_name+'@'+x.destination===key&&x.quantity===1&&x.unit==='set')));

  r=bseInventoryParseMessage_('(ada gambar ambil baja) M3 P1 P2 21/9/2026','2026-09-21T04:00:00.000Z');
  ok('ambil baja without product/qty asks missing facts',r&&r.validation==='NEED_INFO'&&r.candidates.length===2&&r.candidates.every(c=>c.fields.record_type==='INVENTORY_OUT'&&c.missing.includes('item_name')&&c.missing.includes('quantity')&&c.missing.includes('unit')));

  r=bseInventoryParseMessage_('stok baki dripper','2026-09-21T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('stok baki dripper preserves item and asks count',r&&r.validation==='NEED_INFO'&&f.item_name==='Dripper'&&r.candidates[0].missing.includes('counted_quantity'));

  r=bseInventoryParseMessage_('stok kat gudang de baki 500 pcs','2026-09-21T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('stock count 500 pcs does not invent item',r&&r.validation==='NEED_INFO'&&f.counted_quantity===500&&f.unit==='unit'&&r.candidates[0].missing.includes('item_name'));

  r=bseLeaveParseMessage_('DETAIL CUTI\nNAMA shafiq\nDEPARTMENT operation\nTARIKH CUTI 20 September\nALASAN Offday\nGANTI no\nEL no\nAL no\nMC no\nOFFDAY yes','2026-09-20T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('leave 20 September',r&&r.validation==='PASS'&&f.employee_name==='shafiq'&&f.leave_date==='2026-09-20'&&f.leave_type==='Off Day');

  r=bseMaintenanceParseMessage_('paip dah repair','2026-09-21T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('explicit paip repair complete',r&&r.validation==='PASS'&&f.event_type==='MAINTENANCE_COMPLETED'&&f.asset_or_component==='paip');

  r=bsePlantConditionParseMessage_('M3P2 Mati 45 Sakit 455','2026-09-21T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('plant condition explicit counts',r&&r.validation==='PASS'&&f.dead_count===45&&f.sick_count===455&&f.plot_id==='M3P2');

  r=bsePlantConditionParseMessage_('(10 gambar keadaan daun kena penyakit) M3 P12','2026-09-21T04:00:00.000Z');
  ok('disease images do not invent diagnosis/count',r===null);

  r=bsePlantConditionParseMessage_('pindah anak pokok M1P1','2026-09-21T04:00:00.000Z');
  ok('replacement/transplant not plant-condition inference',r===null);

  r=bseTreatmentListParseMessage_('CADANGAN MERACUN\nM3 P1 P2\nAcerio - 30','2026-09-21T04:00:00.000Z');
  f=r&&r.candidates&&r.candidates[0]&&r.candidates[0].fields||{};
  ok('treatment list preserves dose and asks missing crop',r&&r.validation==='NEED_INFO'&&r.candidates[0].missing.includes('crop')&&f.event_status==='COMPLETED'&&f.treatment_description==='Acerio - 30'&&!/(ml|mg|liter)/i.test(f.treatment_description));

  ok('production boundary',
    [bseInventoryParseMessage_('Baja In 4 Set F','2026-09-17T04:00:00.000Z'),
     bseMaintenanceParseMessage_('paip dah repair','2026-09-21T04:00:00.000Z'),
     bsePlantConditionParseMessage_('M3P2 Mati 45 Sakit 455','2026-09-21T04:00:00.000Z')]
      .every(x=>x&&x.production_write===false));

  const failed=tests.filter(t=>!t.pass);
  const summary={total:tests.length,passed:tests.length-failed.length,failed:failed.length,production_write:false,tests:tests};
  console.log('BSE_REAL_MESSAGE_FIELD '+JSON.stringify(summary));
  if(failed.length)throw new Error('Real-message field test gagal: '+failed.map(t=>t.id).join(', '));
  return summary;
}

