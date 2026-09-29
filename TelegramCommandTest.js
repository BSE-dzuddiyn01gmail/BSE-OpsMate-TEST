/** @OnlyCurrentDoc */
// TEST-only Telegram command menu. Publish only commands that are implemented.
const BSE_TG_TEST_COMMANDS=[
  {command:'start',description:'Daftar atau semak akses TEST'},
  {command:'status',description:'Status plot, contoh: /status plot M2P1'},
  {command:'summary',description:'Rumusan plot, contoh: /summary plot M2P1,M2P2'},
  {command:'retrieve',description:'Ambil rekod atau Evidence ikut rujukan'},
  {command:'history',description:'Owner: sejarah TEST, contoh: /history 2026-09'},
  {command:'delete',description:'Owner: delete berjejak dengan alasan'}
];
function configureBseTelegramTestCommands(){const me=bseTelegramApi_('getMe',{});if(!me||me.username!=='bse_kerani_test_bot')throw new Error('Identiti bot TEST tidak sepadan.');const result=bseTelegramApi_('setMyCommands',{commands:BSE_TG_TEST_COMMANDS});if(result!==true)throw new Error('Telegram tidak mengesahkan command menu TEST.');const commands=bseTelegramApi_('getMyCommands',{});if(JSON.stringify(commands)!==JSON.stringify(BSE_TG_TEST_COMMANDS))throw new Error('Command menu Telegram TEST tidak sepadan.');console.log('TELEGRAM_COMMAND_MENU_CONFIGURED: '+JSON.stringify({count:commands.length,production_write:false}));return {commands:commands,production_write:false};}
function runBseTelegramCommandHarnessTests(){const source=configureBseTelegramTestCommands.toString()+BSE_TG_TEST_COMMANDS.map(c=>c.command).join(','),names=BSE_TG_TEST_COMMANDS.map(c=>c.command),tests=[{id:'only implemented commands are published',pass:JSON.stringify(names)===JSON.stringify(['start','status','summary','retrieve','history','delete'])},{id:'history is published but report awaits implementation',pass:names.includes('history')&&!names.includes('report')},{id:'delete remains visible for PoC',pass:names.includes('delete')},{id:'identity and Telegram acknowledgement required',pass:/getMe/.test(source)&&/setMyCommands/.test(source)&&/getMyCommands/.test(source)},{id:'no domain or production writer',pass:!/bse(?:Measurement|CropBatch|Transplant|PlantCensus|Treatment|Inventory)ReviewCore_|production_write\s*:\s*true/.test(source)}];console.log('TELEGRAM_COMMAND_HARNESS: '+JSON.stringify(tests));const failures=tests.filter(t=>!t.pass);if(failures.length)throw new Error('Telegram command harness gagal: '+failures.map(t=>t.id).join(','));return tests;}
