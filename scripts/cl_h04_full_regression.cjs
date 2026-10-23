const fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'..');
const names=fs.readdirSync(dir).filter(x=>x.endsWith('.js')).sort();
const crypto=require('crypto');
const propertyStore=new Map();
const mockProps={getProperty:key=>propertyStore.has(key)?propertyStore.get(key):null,setProperty:(key,value)=>propertyStore.set(key,String(value)),deleteProperty:key=>propertyStore.delete(key)};
const ctx=vm.createContext({console,Utilities:{getUuid:()=> 'test-only',DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest:(algo,input)=>Array.from(crypto.createHash('sha256').update(String(input)).digest()).map(x=>x>127?x-256:x),formatDate:(date,tz,fmt)=>{const d=new Date(date);if(fmt==='yyyy-MM-dd')return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return d.toISOString();}},Session:{getScriptTimeZone:()=> 'Asia/Kuala_Lumpur'},LockService:{},SpreadsheetApp:{},PropertiesService:{getScriptProperties:()=>mockProps}});
let loaded=0;const errors=[];
for(const name of names){try{vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),ctx,{filename:name});loaded++}catch(e){errors.push({file:name,error:e.message})}}
console.log(JSON.stringify({loaded,files:names.length,load_errors:errors}));
if(errors.length)process.exit(1);
try{const r=vm.runInContext('runBseI011FullRegression()',ctx);console.log('FULL_REGRESSION',r.passed,'/',r.total)}catch(e){console.log('REGRESSION_FAILURE',e.message);process.exitCode=2}
