const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map(),stored=new Map();
function $(selector){if(!elements.has(selector))elements.set(selector,{value:'',innerHTML:'',textContent:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},scrollIntoView(){},showModal(){this.open=true},close(){this.open=false},reset(){}});return elements.get(selector)}
class FormData {get(name){return name==='status'?'open':null}}
let publish=async()=>false;
const context={document:{querySelector:$,querySelectorAll:()=>[]},window:{addEventListener(){},publishLibraryReport:(...args)=>publish(...args)},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},location:{href:'https://studysignal.test/'},history:{replaceState(){}},URL,URLSearchParams,FormData,Date,console,setInterval(){},setTimeout(){},clearTimeout(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);
const button={disabled:false},form=$('#reportForm');form.querySelector=()=>button;
const submit=()=>form.onsubmit({preventDefault(){},target:form});
(async()=>{
 $('#reportDialog').open=true;$('#reportZone').value='central';$('#noise').value='Quiet';
 await submit();assert.equal($('#reportDialog').open,true);assert.equal(stored.has('ss-reports'),false,'Rejected reports must not become local student reports');assert.equal(button.disabled,false);
 let resolve,calls=0;publish=()=>{calls++;return new Promise(r=>resolve=r)};
 const pending=submit();assert.equal(button.disabled,true);await submit();assert.equal(calls,1,'Double submission must not duplicate a report');resolve(true);await pending;
 assert.equal($('#reportDialog').open,false);assert.equal(JSON.parse(stored.get('ss-reports')).central.status,'open');assert.equal(button.disabled,false);
 console.log('PASS: failed reports stay retryable without local activity; accepted reports persist; duplicate submissions blocked');
})().catch(error=>{console.error(error);process.exitCode=1});
